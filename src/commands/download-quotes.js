var sprintf    = require('yow/sprintf');
var isArray    = require('yow/is').isArray;
var isString   = require('yow/is').isString;
var isDate     = require('yow/is').isDate;
var isInteger  = require('yow/is').isInteger;
var prefixLogs = require('yow/logs').prefix;
var google     = require('google-finance');
var yahoo      = require('yahoo-finance');
var MySQL      = require('../scripts/mysql.js');
var pushover   = require('../scripts/pushover.js');


var Module = new function() {

	var _db = undefined;
	var _argv = undefined;

	function debug() {
		console.log.apply(this, arguments);
	}

	function defineArgs(args) {

		args.option('symbol',    {alias: 's', describe:'Download specified symbol only'});
		args.option('days',      {alias: 'd', describe:'Specifies number of days back in time to fetch'});
		args.option('since',     {alias: 'c', describe:'Fetch quotes since the specified date'});
		args.option('from',      {alias: 'f', describe:'Fetch quotes from the specified date'});
		args.option('to',        {alias: 't', describe:'Fetch quotes to the specified date'});
		args.option('schedule',  {alias: 'x', describe:'Schedule job at specified cron date/time format'});
		args.option('pause',     {alias: 'p', describe:'Pause for number of seconds between batches', default:30});
		args.help();

		args.wrap(null);

		args.check(function(argv) {

			if ((argv.from && !argv.to) || (!argv.from && argv.to))
				throw new Error('Must specify both --from and --to.');

			if (argv.days && argv.since)
				throw new Error('Cannot specify both --since and --days.');

			if (argv.days && !isInteger(argv.days)) {
				throw new Error(sprintf('Invalid number of days "%s".', argv.days));
			}

			if (argv.from) {
				if (!isDate(new Date(argv.from)))
					throw new Error(sprintf('Invalid date "%s".', argv.from));
			}

			if (argv.to) {
				if (!isDate(new Date(argv.to)))
					throw new Error(sprintf('Invalid date "%s".', argv.to));
			}


			if (argv.since) {
				if (!isDate(new Date(argv.since)))
					throw new Error(sprintf('Invalid date "%s".', argv.since));

			}

			if (!argv.days && !argv.since)
				argv.days = 20;

			return true;
		});

	}



	function updateStatistics(symbol) {

		return new Promise(function(resolve, reject) {

			function computeSMA(quotes, days) {
				if (quotes.length < days)
					return null;

				var sum = 0;

				for (var index = quotes.length - days; index < quotes.length; index++)
					sum += quotes[index].close;

				return parseFloat((sum / days).toFixed(2));
			}

			function computeAV(quotes, days) {
				if (quotes.length < days)
					return null;

				var sum = 0;

				for (var index = quotes.length - days; index < quotes.length; index++)
					sum += quotes[index].volume;

				return parseInt((sum / days).toFixed(0));
			}

			function computeWeekLow(quotes, weeks) {

				var days = weeks * 5;

				if (quotes.length < days)
					return null;

				var min = undefined;

				for (var index = quotes.length - days; index < quotes.length; index++)
					min = (min == undefined) ? quotes[index].close : Math.min(min, quotes[index].close);

				return min;
			}

			function computeWeekHigh(quotes, weeks) {

				var days = weeks * 5;

				if (quotes.length < days)
					return null;

				var max = undefined;

				for (var index = quotes.length - days; index < quotes.length; index++)
					max = (max == undefined) ? quotes[index].close : Math.max(max, quotes[index].close);

				return max;
			}

			function computeATR(quotes, days) {
				if (quotes.length < days + 1)
					return null;

				var sum = 0;

				for (var index = quotes.length - days, count = 0; count < days; count++, index++) {

					var A = quotes[index].high - quotes[index].low;
					var B = Math.abs(quotes[index].low  - quotes[index-1].close);
					var C = Math.abs(quotes[index].high - quotes[index-1].close);

					sum += Math.max(Math.max(A, B), C);
				}

				return parseFloat((sum / days).toFixed(2));
			}


			var query = {};
			query.sql = 'SELECT * FROM quotes WHERE symbol = ? ORDER BY date DESC LIMIT ?';
			query.values = [symbol, 51 * 5];

			_db.query(query).then(function(quotes) {

				var row = {};

				quotes.reverse();

				row.symbol = symbol;
				row.SMA200   = computeSMA(quotes, 200);
				row.SMA50    = computeSMA(quotes, 50);
				row.SMA10    = computeSMA(quotes, 10);
				row.AV14     = computeAV(quotes, 14);
				row.WL51     = computeWeekLow(quotes, 51);
				row.WH51     = computeWeekHigh(quotes, 51);
				row.ATR14    = computeATR(quotes, 14);
				row.updated  = new Date();

				return _db.upsert('stocks', row);
			})

			.then(function(row) {
				resolve();
			})
			.catch(function(error) {
				reject(error);
			});

		});

	}

	function getSymbols() {

		var sql = 'SELECT symbol FROM stocks';

		if (isString(_argv.symbol))
			sql = sprintf('SELECT symbol FROM stocks WHERE symbol LIKE "%s"', _argv.symbol);

		return new Promise(function(resolve, reject) {

			_db.query(sql).then(function(rows) {

				var symbols = [];

				rows.forEach(function(row) {
					symbols.push(row.symbol);
				});

				resolve(symbols);
			})
			.catch(function(error) {
				reject(error);

			});
		});
	}

	function upsert(quotes) {
		return new Promise(function(resolve, reject) {

			try {
				function round(value) {
					return parseFloat(value).toFixed(4);
				}

				var promise = Promise.resolve();

				quotes.forEach(function(quote) {
					promise = promise.then(function() {
						return _db.upsert('quotes', quote);

					})
					.catch(function(error) {
						console.log('NOOOO');
						reject(error);

					});
				});

				promise.then(function() {
					resolve(quotes.length);
				})
				.catch(function(error) {
					reject(error);
				});

			}
			catch(error) {
				reject(error);
			}

		});

	}


	function download(symbols, from, to) {

		return new Promise(function(resolve, reject) {


			function delay(ms) {
				return new Promise(function(resolve, reject) {
					setTimeout(resolve, ms);
				});
			}

			function round(value) {
				return value == null ? null : parseFloat(parseFloat(value).toFixed(4));
			}

			function fetchFromProvider(provider, symbol, from, to) {

				return new Promise(function(resolve, reject) {
					var options = {};
					options.symbol = symbol;
					options.from   = from;
					options.to     = to;

					provider.historical(options, function (error, quotes) {

						var entries = {};

						quotes.forEach(function(quote) {
							var entry = {};

							entry.date   = quote.date;
							entry.symbol = quote.symbol;
							entry.open   = round(quote.open);
							entry.high   = round(quote.high);
							entry.low    = round(quote.low);
							entry.close  = round(quote.close);
							entry.volume = quote.volume;

							var key = sprintf('%04d-%02d-%02d', entry.date.getFullYear(), entry.date.getMonth() + 1, entry.date.getDate());
							entries[key] = entry;
						});

						resolve(entries);
					});

				});
			}

			function isValidQuote(quote) {
				return quote && quote.open != null && quote.close != null && quote.high != null && quote.low != null;
			}


			function fetch(symbol, from, to) {

				return new Promise(function(resolve, reject) {

					var googleQuotes = [];
					var yahooQuotes = [];

					Promise.resolve().then(function(){
						return fetchFromProvider(google, symbol, from, to);
					})
					.then(function(quotes) {
						googleQuotes = quotes;
					})
					.then(function() {
						return fetchFromProvider(yahoo, symbol, from, to);
					})
					.then(function(quotes) {
						yahooQuotes = quotes;
					})
					.then(function() {
						var quotes = [];
						var date = new Date(from);

						while (date <= to) {
							var key = sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());
							var googleQuote = googleQuotes[key];
							var yahooQuote  = yahooQuotes[key];

							if (isValidQuote(yahooQuote))
								quotes.push(yahooQuote);
							else if (isValidQuote(googleQuote))
								quotes.push(googleQuote);

							date.setDate(date.getDate() + 1);
						}

						resolve(quotes);
					})
					.catch(function(error) {
						reject(error);
					})
				});
			}

			console.log(sprintf('Fetching historical quotes from %s to %s...', from.toLocaleDateString(), to.toLocaleDateString()));

			if (!isArray(symbols))
				symbols = [symbols];

			var promise = Promise.resolve();
			var counter = 0;

			symbols.forEach(function(symbol) {
				promise = promise.then(function() {
					return fetch(symbol, from, to);
				})
				.then(function(quotes) {
					console.log(sprintf('Updating %d quotes for \'%s\'...', quotes.length, symbol));
					return upsert(quotes);
				})
				.then(function() {
					return updateStatistics(symbol);
				})
				.then(function() {
					counter++;

					if ((counter % 15) == 0) {
						console.log('Pausing for %s seconds...', _argv.pause);
						return delay(_argv.pause * 1000);
					}
					else {
						return delay(0);
					}
				})
			});

			promise.then(function() {
				resolve(symbols.length);
			})
			.catch(function(error) {
				reject(error);
			});

		});
	}

	function process() {


		return new Promise(function(resolve, reject) {

			getSymbols().then(function(symbols) {
				try {

					var startDate = new Date();
					var endDate = new Date();

					if (_argv.since) {
						startDate = new Date(_argv.since);
					}

					if (_argv.days) {
						startDate.setDate(startDate.getDate() - _argv.days);
					}

					if (_argv.from) {
						startDate = new Date(_argv.from);
						endDate   = new Date(_argv.to);
					}

					download(symbols, startDate, endDate).then(function() {
						return Promise.resolve(symbols.length);
					})
					.then(function(count) {
						resolve(count);
					})
					.catch(function(error) {
						reject(error);
					});

				}
				catch(error) {
					reject(error);

				}

			});
		});

	}




	function work() {

		return new Promise(function(resolve, reject) {
			var mysql = new MySQL();

			Promise.resolve().then(function() {
				return mysql.connect();
			})
			.then(function(db) {
				_db = db;
				return process();
			})
			.then(function(count) {
				pushover.notify(sprintf('Finished downloading quotes. A total of %d symbol(s) downloaded and updated.', count));
				resolve();
			})
			.catch(function(error) {
				pushover.error(error);
				console.log(error.stack);
				reject(error);
			})
			.then(function() {
				_db.end();
			});
		});
	}


	function schedule(cron) {

		try {
			var Schedule = require('node-schedule');
			var running  = false;

			console.log(sprintf('Scheduling to run at cron-time "%s"...', cron));

			var job = Schedule.scheduleJob(cron, function() {

				try {
					if (running) {
						throw new Error('Upps! Running already!!');
					}
					else {
						running = true;

						work().then(function() {
							running = false;
						})
						.catch(function(error) {
							running = false;
						});
					}

				}
				catch(error) {
					pushover.error(error);
					console.log(error.stack);
				}
			});

			if (job == null) {
				throw new Error('Invalid cron time.');
			}

			return Promise.resolve();

		}
		catch(error) {
			return Promise.reject(error);
		}

	}



	function run(argv) {

		try {
			_argv = argv;

			prefixLogs();

			var promise = Promise.resolve();

			if (isString(_argv.schedule))
				promise = schedule(_argv.schedule);
			else
				promise = work();

			promise.then(function() {

			})
			.catch(function(error) {
				console.log(error.stack);

			});

		}
		catch(error) {
			console.log(error.stack);
		}
	}

	module.exports.command  = ['download-quotes [options]', 'dq [options]'];
	module.exports.describe = 'Download historical data from Google Finance';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
