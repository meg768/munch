#!/usr/bin/env node

var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var Schedule = require('node-schedule');

var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var isString   = require('yow').isString;
var fileExists = require('yow').fileExists;
var mkdir      = require('yow').mkdir;
var mkpath     = require('yow').mkpath;
var isInteger  = require('yow').isInteger;
var prefixLogs = require('yow').prefixLogs;

var Gopher  = require('rest-request');
var MySQL   = require('./src/scripts/mysql.js');

var App = function() {


	var _fetchCount        = undefined;
	var _numberOfDays      = undefined;
	var _delay             = undefined;
	var _busy              = false;


	function getMySQL() {

		var options = {
			host     : '104.155.92.17',
			user     : 'root',
			password : 'potatismos',
			database : 'munch'
		};

		return new MySQL(options);
	};


	function parseArgs() {
		var args = require('commander');

		args.version('1.0.0');
		args.option('-c --count <number>', 'Number of quotes to fetch per batch (10)', 10);
		args.option('-d --days <number>', 'Number of days back to fetch quotes (14)', 14);
		args.option('-p --pause <number>', 'Number of seconds to pause before fetching next batch (15)', 15);

		args.parse(process.argv);

		return args;

	}




	function stringify(o) {
		return JSON.stringify(o, null, '\t');
	}



	function getSymbolsToUpdate(db, sinceDate) {

		return new Promise(function(resolve, reject) {

			var query = {};

			query.sql = '';
			query.sql += sprintf('SELECT symbol from stocks ');
			query.sql += sprintf('WHERE downloaded = \'\' OR downloaded IS NULL OR downloaded < ? ');
			query.sql += sprintf('ORDER by downloaded ASC, symbol ASC');

			query.values = [sinceDate.toISOString()];

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


	function resetDownloads(db) {
		return new Promise(function(resolve, reject) {

			var query = {};
			query.sql    = 'UPDATE stocks SET downloaded = NULL';
			query.values = [];

			db.query(query).then(function(a, b, c) {
				console.log(sprintf('The downloaded timestamp of all stocks have been cleared.'));
				resolve();

			})
			.catch(function(error){
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






	function download(db, sinceDate) {

		return new Promise(function(resolve, reject) {
			getSymbolsToUpdate(db, sinceDate).then(function(symbols) {

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


	function runBatch(sinceDate) {

		var mysql = getMySQL();

		return new Promise(function(resolve, reject) {
			mysql.connect().then(function(db) {

				download(db, sinceDate).then(function(symbols) {
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


	function runOnce() {

		var failCount = 0;

		return new Promise(function(resolve, reject) {
			var sinceDate = new Date();

			function loop() {
				runBatch(sinceDate).then(function(symbols) {
					if (symbols.length > 0) {
						console.log('Updated %d stocks, waiting to start next batch...', symbols.length);
						setTimeout(loop, _delay * 1000);
					}
					else {
						resolve();
					}
				})
				.catch(function(error) {
					if (failCount++ < 10) {
						console.log('Error running batch. Will try again...');
						console.log(error);
						setTimeout(loop, 30 * 1000);

					}
					else {
						reject(error)
					}
				});


			}

			loop();

		});


	}

	function reset() {

	}

	function schedule() {

		var busy    = false;
		var rule    = new Schedule.RecurrenceRule();
		rule.hour   = 20;
		rule.minute = 45;

		console.log(sprintf('Scheduling to start daily work at %02d:%02d', rule.hour, rule.minute));

		Schedule.scheduleJob(rule, function() {
			if (busy) {
				console.log('Busy. Try again later.');
			}
			else {
				busy = true;

				runOnce().then(function() {
					console.log('Finished.');
				})
				.catch(function(error) {
					console.log(error);
				})
				.finally(function() {
					busy = false;
				});
			}
		});



	};

	function run() {

		prefixLogs();

		var args = parseArgs();

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

		if (args.pause)
			_delay = parseInt(args.pause);

		if (_delay == undefined) {
			console.log('No --delay specified. Assuming 15 seconds');
			_delay = 15;
		}

		if (_delay < 1)
			_delay = 1;

		console.log(sprintf('Fetch count is set to %d every %d second(s) and fetching %d days of quotes.', _fetchCount, _delay, _numberOfDays));

		schedule();

	};


	run();
};

new App();
