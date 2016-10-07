
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var Progress = require('progress');

var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var isString   = require('yow').isString;
var fileExists = require('yow').fileExists;
var mkdir      = require('yow').mkdir;
var mkpath     = require('yow').mkpath;
var isInteger  = require('yow').isInteger;

var Gopher  = require('rest-request');



var Module = module.exports = function(args) {


	var _fetchCount     = undefined;
	var _numberOfDays   = undefined;


	if (args.count)
		_fetchCount = parseInt(args.count);

	if (args.days)
		_numberOfDays = parseInt(args.days);

	if (_numberOfDays == undefined) {
		console.warn('Number of days to download is not specified. Assuming 5.');
		_numberOfDays = 5;
	}

	if (_numberOfDays > 14)
		_numberOfDays = 14;

	if (_fetchCount == undefined) {
		console.warn('Number of stocks to update not specified. Assuming 10.');
		_fetchCount = 10;
	}


	function stringify(o) {
		return JSON.stringify(o, null, '\t');
	}



	function getSymbolsToUpdate(db) {

		return new Promise(function(resolve, reject) {
			var date = new Date();
			date.setDate(date.getDate() - 1);

			var query = {};

			query.sql = '';
			query.sql += sprintf('SELECT symbol from stocks ');
			query.sql += sprintf('WHERE downloaded = \'\' OR downloaded IS NULL OR downloaded < ? ');
			query.sql += sprintf('ORDER by symbol ASC, downloaded ASC');

			query.values = [date.toISOString()];

			db.query(query).then(function(rows) {
				if (rows.length > 0) {
					console.log(sprintf('%d stocks needs an update...', rows.length));
				}

				// Only picks the first ones
				rows = rows.slice(0, _fetchCount);

				var symbols = rows.map(function(row) {
					return row.symbol;
				});

				resolve(symbols);

			})
			.catch(function(error) {
				reject(error);
			});

		});
	}






	function downloadQuotes(db, symbol) {

		return new Promise(function(resolve, reject) {
			requestQuotes(symbol, _numberOfDays, 60).then(function(quotes) {

				Promise.each(quotes, function(quote) {
					return db.upsert('quotes', quote);
				})

				.then(function() {
					var now = new Date();

					var query = {};
					query.sql    = 'UPDATE ?? SET ?? = ? WHERE ?? = ?';
					query.values = ['stocks', 'downloaded', now.toISOString(), 'symbol', symbol];


					db.query(query).then(function(a, b, c) {
						console.log(sprintf('Updated %s with %d quotes.', symbol, quotes.length));
						resolve(quotes);

					})
					.catch(function(error){
						reject(error);

					});
				})

				.catch(function(error) {
					reject(error);
				});


			})

			.catch(function(error, response, body) {
				console.error(sprintf('Failed loading %s', symbol));
				reject(error);
			});

		});

	}


	function requestQuotes(symbol, days, interval) {

		var gopher = new Gopher('http://www.google.com/finance');

		return new Promise(function(resolve, reject) {
			var params = {};
			params.q = symbol;
			params.i = interval;
			params.p = sprintf('%dd', days);
			params.f = 'd,o,h,l,c,v';

//			console.log(sprintf('Requesting quotes for %d days for symbol %s...', days, symbol));

			var request = gopher.request('GET', 'getprices', params);

			request.then(function(result) {
				try {
					resolve(parseQuotes(symbol, result));

				}
				catch (error) {
					reject(error);

				};
			})
			.catch(function(error) {
				reject(error);
			});

		});

	}


	function parseQuotes(symbol, text) {

		var rows = text.split('\n');

		var header = {};

		header.exchange       = rows.shift();
		header.marketOpen     = parseInt(rows.shift().split('=')[1]);
		header.marketClose    = parseInt(rows.shift().split('=')[1]);
		header.interval       = parseInt(rows.shift().split('=')[1]);
		header.columns        = rows.shift().split('=')[1].split(',');
		header.data           = rows.shift().split('=')[1];
		header.timezoneOffset = parseInt(rows.shift().split('=')[1]);

		var quotes = [];
		var date, time;

		if (!isInteger(header.timezoneOffset)) {
			/*
			console.log('Invalid header!!!');
			console.log('--------------------------------');
			console.log(text);
			console.log('--------------------------------');
			*/
			return quotes;
		}

		rows.forEach(function(row) {
			var cols = row.split(',');

			if (cols.length == 6) {
				var quote = {};

				if (cols[0][0] == 'a') {
					date = new Date(parseInt(cols[0].substring(1)) * 1000);
					date = new Date(date.getTime() + 1000 * header.timezoneOffset * 60);
					time = date;
				}
				else {
					time = new Date(date.getTime() + 1000 * header.interval * parseInt(cols[0]));
				}

				var dateKey = sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());
				var timeKey = sprintf('%02d:%02d', time.getUTCHours(), time.getUTCMinutes());

				quote.symbol  = symbol;
				quote.date    = dateKey;
				quote.time    = timeKey;
				quote.close   = parseFloat(cols[1]);
				quote.high    = parseFloat(cols[2]);
				quote.low     = parseFloat(cols[3]);
				quote.open    = parseFloat(cols[4]);
				quote.volume  = parseInt(cols[5]);

				quotes.push(quote);
			}
		})

		return quotes;

	}






	function process(db) {

		return new Promise(function(resolve, reject) {
			getSymbolsToUpdate(db).then(function(symbols) {

				Promise.each(symbols, function(symbol) {
					return downloadQuotes(db, symbol).then(function(quotes) {
					});
				})

				.then(function() {
					resolve(symbols);
				})

				.catch(function(error) {
					reject(error);
				});

			})
			.catch(function(error) {
				reject(error);
			});

		});

	}


	function run() {

		var options = {
			//host     : '130.211.79.11',
			// host     : '104.199.47.32',
			host     : '104.155.92.17',
			user     : 'root',
			password : 'potatismos',
			database : 'munch'
		};

		var MySQL = require('../scripts/mysql.js');
		var mysql = new MySQL(options);

		return new Promise(function(resolve, reject) {
			mysql.connect().then(function(db) {

				process(db).then(function(symbols) {
					resolve(symbols);
				})
				.catch(function(error) {
					reject(error);
				})
				.finally(function() {
					db.end();

				});
			})
			.catch(function(error) {
				reject(error);
			});

		});


	}


	function schedule() {
		var delay = undefined;

		if (args.delay)
			delay = parseInt(args.delay);

		if (delay == undefined) {
			console.log('No --delay specified. Assuming 15 seconds');
			delay = 15;
		}

		if (delay < 1)
			delay = 1;

		console.log(sprintf('Fetch count is set to %d every %d second(s) and fetching %d days of quotes.', _fetchCount, delay, _numberOfDays));


		function loop() {
			run().then(function(symbols) {
				if (symbols.length > 0)
					setTimeout(loop, delay * 1000);
				else {
					console.log('Finished.');
				}
			})
			.catch(function(error) {
				setTimeout(loop, 30 * 1000);
				console.log(error);
			});


		}

		loop();

	}


	this.run = function() {
		schedule();
	}

};
