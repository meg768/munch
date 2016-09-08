
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');

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
		console.warn('Number of days to download is not specified. Assuming 7.');
		_numberOfDays = 7;
	}

	if (_numberOfDays > 14)
		_numberOfDays = 14;

	if (_fetchCount == undefined) {
		console.warn('Number of stocks to update not specified. Assuming 3.');
		_fetchCount = 3;
	}

	function connect() {

		var mysql = require('mysql');

		var connection  = mysql.createConnection({
			host     : '104.199.12.40',
			user     : 'root',
			password : 'potatismos',
			database : 'munch_test'
		});

		return new Promise(function(resolve, reject) {
			connection.connect(function(error) {
				if (error) {
					console.error('Error connecting: ' + error.stack);
					reject(error);
				}

				resolve(connection);
			});
		});

	}

	function upsertRow(db, table, row) {

		return new Promise(function(resolve, reject) {
			var data = [];
			var columns = [];

			Object.keys(row).forEach(function(column) {
				columns.push('`' + column + '`');
				data.push(row[column]);
			});

			var sql = '';

			sql += sprintf('INSERT INTO `%s` (%s) VALUES (?) ', table, columns.join(','));
			sql += sprintf('ON DUPLICATE KEY UPDATE ');

			sql += columns.map(function(column) {
				return sprintf('%s = VALUES(%s)', column, column);
			}).join(',');

			var query = db.query(sql, [data], function(error, result) {
				if (error)
					reject(error);
				else
					resolve();
			});

			//console.log(query.sql);

		});

	}

	function getSymbols(db) {

		return new Promise(function(resolve, reject) {
			var query = db.query('SELECT symbol from stocks ORDER by symbol', function(error, rows, fields) {

				if (error)
					reject(error);
				else {
					var symbols = rows.map(function(row) {
						return row.symbol;
					});

					resolve(symbols);
				}
			});
		});
	}



	function stringify(o) {
		return JSON.stringify(o, null, '\t');
	}



	function getSymbolsToUpdate(db) {

		return new Promise(function(resolve, reject) {

			var date = new Date();
			date.setDate(date.getDate() - 1);

			var sql = '';
			sql += sprintf('SELECT symbol from stocks ');
			sql += sprintf('WHERE downloaded = \'\' OR downloaded IS NULL OR downloaded < ? ');
			sql += sprintf('ORDER by symbol ASC, downloaded ASC');

			var query = db.query(sql, [date.toISOString()], function(error, rows, fields) {

				if (error)
					reject(error);
				else {
					if (rows.length > 0) {
						console.log(sprintf('%d stocks needs an update...', rows.length));
					}

					// Only picks the first ones
					rows = rows.slice(0, _fetchCount);

					var symbols = rows.map(function(row) {
						return row.symbol;
					});

					resolve(symbols);
				}
			});

			console.log(query.sql);

		});
	}






	function downloadQuotes(db, symbol) {

		return new Promise(function(resolve, reject) {
			console.log(sprintf('Downloading quotes for symbol %s...', symbol));

			requestQuotes(symbol, _numberOfDays, 60).then(function(quotes) {

				console.log(sprintf('Saving %d quotes for symbol %s...', quotes.length, symbol));

				Promise.each(quotes, function(quote) {
					//console.log(stringify(quote));
					return upsertRow(db, 'quotes', quote);
				})

				.then(function() {
					var now = new Date();
					var sql = sprintf('UPDATE stocks SET downloaded = ? WHERE symbol = ?');

					var query = db.query(sql, [now.toISOString(), symbol], function(error, result) {
						if (error)
							reject(error);
						else
							resolve(quotes);
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

			console.log(sprintf('Requesting quotes for %d days for symbol %s...', days, symbol));

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
			console.log('Invalid header!!!');
			console.log('--------------------------------');
			console.log(text);
			console.log('--------------------------------');

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
						console.log(sprintf('Downloaded %d quotes for symbol %s.', quotes.length, symbol));
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

		return new Promise(function(resolve, reject) {
			connect().then(function(db) {

				process(db).then(function(symbols) {
					resolve(symbols);
				})
				.catch(function(error) {
					reject(error);
				})
				.finally(function() {
					db.destroy();

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
					console.log('Nothing to to. Waiting for 5 minutes.');
					setTimeout(loop, 1000 * 60 * 5);

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

/*

		if (isString(args.symbol)) {
			var symbol = args.symbol;

			if (symbolExists(symbol))
				fetchQuotes(symbol);
			else
				console.log(sprintf('Symbol \'%s\' does not exist.', symbol));
		}
		else  {

			console.log(sprintf('Started downloading quotes to folder \'%s\'...', _quotesFolder));

			schedule();


		}
		*/
	}

};
