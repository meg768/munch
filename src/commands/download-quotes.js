var google = require('google-finance');
var yahoo  = require('yahoo-finance');

var sprintf    = require('yow/sprintf');
var isArray    = require('yow/is').isArray;
var isString   = require('yow/is').isString;
var isDate     = require('yow/is').isDate;
var isInteger  = require('yow/is').isInteger;
var prefixLogs = require('yow/logs').prefix;
var MySQL      = require('../scripts/mysql.js');
var pushover   = require('../scripts/pushover.js');


var Module = new function() {

	var _db = undefined;
	var _argv = undefined;

	function defineArgs(args) {

		args.option('symbol',    {alias: 's', describe:'Download specified symbol only'});
		args.option('days',      {alias: 'd', describe:'Specifies number of days back in time to fetch'});
		args.option('since',     {alias: 'c', describe:'Fetch quotes since the specified date'});
		args.option('schedule',  {alias: 'x', describe:'Schedule job at specified cron date/time format'});
		args.option('batch',     {alias: 'b', describe:'Batch fetch size', default:15});
		args.option('pause',     {alias: 'p', describe:'Pause between batches in seconds', default:30});
		args.option('service',   {alias: 'v', describe:'Google or Yahoo', choices:['google', 'yahoo', 'goohoo'], default:'goohoo'});
		args.help();

		args.wrap(null);

		args.check(function(argv) {
			if (argv.days && argv.since)
				throw new Error('Cannot specify both --since and --days.');

			if (argv.days && !isInteger(argv.days)) {
				throw new Error(sprintf('Invalid number of days "%s".', argv.days));
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

		if (isString(_argv.symbol))
			return Promise.resolve([_argv.symbol]);

		return new Promise(function(resolve, reject) {

			_db.query('SELECT symbol FROM stocks').then(function(rows) {

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
						var row = {};
						row.date   = new Date(quote.date);
						row.symbol = quote.symbol;
						row.open   = round(quote.open);
						row.high   = round(quote.high);
						row.low    = round(quote.low);
						row.close  = round(quote.close);
						row.volume = quote.volume;

						return _db.upsert('quotes', row);

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



			function fetch(symbol, from, to) {

				function fetchFromService(service, symbol, from, to) {

					return new Promise(function(resolve, reject) {

						var options = {};
						options.symbol = symbol;
						options.from   = new Date(from);
						options.to     = new Date(to);
						service.historical(options, function (error, quotes) {
							if (error)
								reject(error);
							else {
								resolve(quotes.filter(function(quote) {
									return quote.open != null && quote.high != null && quote.low != null && quote.close != null;
								}));

							}
						});

					});
				}

				return new Promise(function(resolve, reject) {

					var quotes = [];

					Promise.resolve().then(function() {
						if (_argv.service == 'google' || _argv.service == 'goohoo') {
							console.log(sprintf('Fetching Google quotes from %s to %s...', from.toLocaleDateString(), to.toLocaleDateString()));

							return fetchFromService(google, symbol, from, to).then(function(googleQuotes) {
								quotes = quotes.concat(googleQuotes);
							})

						}
						else {
							return Promise.resolve();
						}

					})

					.then(function() {
						if (_argv.service == 'yahoo' || _argv.service == 'goohoo') {
							console.log(sprintf('Fetching Yahoo quotes from %s to %s...', from.toLocaleDateString(), to.toLocaleDateString()));

							return fetchFromService(yahoo, symbol, from, to).then(function(yahooQuotes) {
								quotes = quotes.concat(yahooQuotes);
							})

						}
						else {
							return Promise.resolve();
						}

					})

					.then(function() {
						var quoteMap = {};
						var mergedQuotes = [];

						// Clean up the quotes, making all dates to local timezone
						quotes = quotes.map(function(quote) {
							var date = new Date(quote.date);

							var entry = {};
							entry.date   = new Date(sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate()));
							entry.symbol = symbol;
							entry.open   = quote.open;
							entry.high   = quote.high;
							entry.low    = quote.low;
							entry.close  = quote.close;
							entry.volume = quote.volume;

							return entry;
						});

						quotes.forEach(function(quote) {
							quoteMap[quote.date.toDateString()] = quote;
						});

						for (var key in quoteMap) {
							mergedQuotes.push(quoteMap[key]);
						}


						resolve(mergedQuotes);
					})
					.catch(function(error) {
						reject(error);
					});


				});
			}


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

					if ((counter % _argv.batch) == 0) {
						console.log('Pausing for', _argv.pause, 'seconds...');
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

					download(symbols, startDate, endDate).then(function() {
						return Promise.resolve(symbols.length);
					})
					.then(function(count) {
						console.log(sprintf('A total of %d symbol(s) downloaded and updated.', count));
						resolve();
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

			mysql.connect().then(function(db) {

				_db = db;

				process().then(function() {
					db.end();
					resolve();
				})

				.catch(function(error) {
					db.end();
					reject(error);
				})
			})

			.catch(function(error) {
				reject(error);
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

							pushover.error(error);
							console.log(error.stack);
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
				pushover.error(error);

			});

		}
		catch(error) {
			console.log(error.stack);
			pushover.error(error);
		}
	}

	module.exports.command  = ['download-quotes [options]', 'dq [options]'];
	module.exports.describe = 'Download historical data from Google Finance';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
