#!/usr/bin/env node

var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var Schedule = require('node-schedule');

var sprintf    = require('yow/sprintf');
var extend     = require('yow/extend');
var isString   = require('yow/is').isString;
var fileExists = require('yow/fs').fileExists;
var mkdir      = require('yow/fs').mkdir;
var mkpath     = require('yow/fs').mkpath;
var isInteger  = require('yow/is').isInteger;
var prefixLogs = require('yow/logs').prefix;

var Gopher  = require('rest-request');
var MySQL   = require('../scripts/mysql.js');
var alert   = require('../scripts/alert.js');

var Command = new function() {


	var _fetchCount        = undefined;
	var _numberOfDays      = undefined;
	var _delay             = undefined;
	var _busy              = false;
	var olle = 0;
	

	function defineArgs(args) {

		args.option('count',    {alias: 'c', describe:'Number of quotes to fetch per batch', default:10});
		args.option('days',     {alias: 'd', describe:'Specifies number of days back in time to fetch', default: 5});
		args.option('pause',    {alias: 'p', describe:'Number of seconds to pause before fetching next batch', default:15});
		args.option('schedule', {alias: 'x', describe:'Schedule job at specified cron date/time format'});
		args.help();

		args.wrap(null);

		args.check(function(argv) {
			if (argv.days > 14 || argv.days < 1)
				throw new Error('Number of days must be from 1 - 14.');

			return true;
		});

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
					return db.upsert('ticks', quote);
				})

				.then(function() {
					var now = new Date();

					var query = {};
					query.sql    = 'UPDATE ?? SET ?? = ? WHERE ?? = ?';
					query.values = ['stocks', 'downloaded', now, 'symbol', symbol];


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

		var mysql = new MySQL();

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
					alert(error);

					if (failCount++ < 10) {
						console.error('Error running batch. Will try again...');
						console.error(error);
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

	function schedule(cron) {

		var busy    = false;

		console.log(sprintf('Scheduling to start work at cron-time "%s"...', cron));

		var job = Schedule.scheduleJob(cron, function() {
			if (busy) {
				console.log('Busy. Try again later.');
			}
			else {
				busy = true;

				runOnce().then(function() {
					console.log('Finished for today.');
				})
				.catch(function(error) {
					console.log(error);
				})
				.finally(function() {
					busy = false;
				});
			}
		});


		if (job == null) {
			throw new Error('Invalid cron time.');
		}

	};

	function run(args) {

		try {
			prefixLogs();

			_fetchCount = parseInt(args.count);
			_numberOfDays = parseInt(args.days);
			_delay = parseInt(args.pause);

			if (_numberOfDays > 14)
				_numberOfDays = 14;

			if (_delay < 1)
				_delay = 1;

			console.log(sprintf('Fetch count is set to %d every %d second(s) and fetching %d days of quotes.', _fetchCount, _delay, _numberOfDays));

			if (isString(args.schedule)) {
				schedule(args.schedule);
			}
			else {
				runOnce().then(function() {
					console.log('Finished for today.');
				})
				.catch(function(error) {
					console.error(error);
				})

			}


		}
		catch(error) {
			alert(error);
			console.error(error);
		}

	};


	module.exports.command  = ['download-ticks [options]', 'dt [options]'];
	module.exports.describe = 'Download ticks from Google Finance';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;

};




//2017-01-12	118.895	119.3	118.21	119.25
