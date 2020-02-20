var sprintf    = require('yow/sprintf');
var isArray    = require('yow/isArray');
var isString   = require('yow/isString');
var isDate     = require('yow/isDate');
var isInteger  = require('yow/isInteger');
var google     = require('google-finance');
var yahoo      = require('yahoo-finance');
var MySQL      = require('../scripts/mysql.js');

require('pushover-console');

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
		args.option('pause',     {alias: 'p', describe:'Pause for number of seconds between batches', default:10});
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

			return true;
		});

	}

	function dateToString(date) {
		if (!date)
			date = new Date();

		return sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());

	}


	function updateStock(symbol) {

		return new Promise(function(resolve, reject) {


			function computeSMA(quotes, days) {
				if (quotes.length < days)
					return null;

				var sum = 0;

				for (var index = 0; index < days; index++) {
					sum += quotes[index].close;

				}

				return parseFloat((sum / days).toFixed(2));
			}

			function computeAV(quotes, days) {
				if (quotes.length < days)
					return null;

				var sum = 0;

				for (var index = 0; index < days; index++)
					sum += quotes[index].volume;

				return parseInt((sum / days).toFixed(0));
			}

			function computeWeekLow(quotes, weeks) {

				var days = weeks * 5;

				if (quotes.length < days)
					return null;

				var min = undefined;

				for (var index = 0; index < days; index++)
					min = (min == undefined) ? quotes[index].close : Math.min(min, quotes[index].close);

				return min;
			}

			function computeWeekHigh(quotes, weeks) {

				var days = weeks * 5;

				if (quotes.length < days)
					return null;

				var max = undefined;

				for (var index = 0; index < days; index++)
					max = (max == undefined) ? quotes[index].close : Math.max(max, quotes[index].close);

				return max;
			}

			function computeATR(quotes, days) {
				if (quotes.length < days + 1)
					return null;

				var sum = 0;

				for (var index = 0; index < days; index++) {

					var A = quotes[index].high - quotes[index].low;
					var B = Math.abs(quotes[index].low  - quotes[index+1].close);
					var C = Math.abs(quotes[index].high - quotes[index+1].close);

					sum += Math.max(Math.max(A, B), C);
				}

				return parseFloat((sum / days).toFixed(2));
			}

			function getGeneralInformation(symbol) {
				return new Promise((resolve, reject) => {


					Promise.resolve().then(() => {
						var query = {};
						query.sql = 'SELECT * FROM stocks WHERE ?? = ?';
						query.values = ['symbol', symbol];

						return _db.query(query);

					})
					.then((stocks) => {
						if (stocks.length == 1)
							return Promise.resolve(stocks[0]);
						else {
							return Promise.resolve({});
						}

					})
					.then((stock) => {
						if (stock.type == '' || stock.type == null || stock.exchange == '' || stock.exchange == null || stock.sector == '' || stock.sector == null || stock.industry == '' || stock.industry == null) {
							var options = {};

							options.symbol = symbol;
							options.modules = ['price', 'summaryProfile'];

							console.log(sprintf('Fetching summary profile from Yahoo for symbol %s.', symbol));

							yahoo.quote(options).then((data) => {
								stock = {};
								stock.updated = new Date();
								stock.name = data.price.longName ? data.price.longName : data.price.shortName;
								stock.sector = data.summaryProfile ? data.summaryProfile.sector : 'n/a';
								stock.industry = data.summaryProfile ? data.summaryProfile.industry : 'n/a';
								stock.exchange = data.price.exchangeName;
								stock.type = data.price.quoteType.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

								// Fix some stuff
								stock.name = stock.name == null ? 'n/a' : stock.name;
								stock.name = stock.name.replace(/&amp;/g, '&');

								resolve(stock);

							})
							.catch((error) => {
								console.log(sprintf('Could not get general information about symbol %s. %s', symbol, error.message));
								resolve({});
							});
						}
						else {
							resolve({});
						}
					})
					.catch((error) => {
						console.log(sprintf('Something happend for symbol %s. %s', symbol, error.message));
						resolve({});
					})

				});
			}

			function getStatistics(symbol) {
				return new Promise((resolve, reject) => {

					var query = {};
					query.sql = 'SELECT * FROM quotes WHERE symbol = ? ORDER BY date DESC LIMIT ?';
					query.values = [symbol, 51 * 5];

					_db.query(query).then(function(quotes) {

						var stock = {};

						if (quotes.length > 0) {
							stock.symbol   = symbol;
							stock.updated  = new Date();
							stock.SMA200   = computeSMA(quotes, 200);
							stock.SMA50    = computeSMA(quotes, 50);
							stock.SMA20    = computeSMA(quotes, 20);
							stock.SMA10    = computeSMA(quotes, 10);
							stock.AV14     = computeAV(quotes, 14);
							stock.WL51     = computeWeekLow(quotes, 51);
							stock.WH51     = computeWeekHigh(quotes, 51);
							stock.ATR14    = computeATR(quotes, 14);
						}

						return stock;
					})

					.then((stock) => {
						resolve(stock);
					})
					.catch(function(error) {
						reject(error);
					});

				});

			}

			var stock = {};
			var statistics = {};

			Promise.resolve().then(() => {
				return getGeneralInformation(symbol);
			})
			.then((data) => {
				stock = Object.assign({}, stock, data);
			})
			.then(() => {
				return getStatistics(symbol);
			})
			.then((data) => {
				statistics = Object.assign({}, statistics, data);
				stock = Object.assign({}, stock, data);
			})
			.then(() => {
				if (statistics.symbol) {
					return _db.upsert('statistics', statistics);
				}
				else
					return Promise.resolve();
			})
			.then(() => {
				if (stock.symbol)
					return _db.upsert('stocks', stock);
				else
					return Promise.resolve();
			})
			.then(() => {
				resolve(stock);
			})
			.catch(function(error) {
				reject(error);
			});

		});

	}

	function getStartDates() {

		var sql = 'SELECT symbol, MAX(date) as date FROM quotes GROUP BY symbol';

		return new Promise(function(resolve, reject) {

			console.log('Fetching last quote dates...');

			_db.query(sql).then(function(rows) {

				var dates = {};
				rows.forEach(function(row) {
					var date = new Date(row.date);
					date.setDate(date.getDate() + 1);

					dates[row.symbol] = date;
				});

				resolve(dates);
			})
			.catch(function(error) {
				reject(error);

			});
		});
	}


	function deleteSymbol(symbol) {

		function deleteFromStocks(symbol) {
			return new Promise(function(resolve, reject) {

				var query = {};
				query.sql = 'DELETE FROM ?? WHERE ?? = ?';
				query.values = ['stocks', 'symbol', symbol];

				_db.query(query).then(() => {
					resolve(null);
				})
				.catch(function(error) {
					reject(error);

				});
			});

		}

		function deleteFromQuotes(symbol) {
			return new Promise(function(resolve, reject) {

				var query = {};
				query.sql = 'DELETE FROM ?? WHERE ?? = ?';
				query.values = ['quotes', 'symbol', symbol];

				_db.query(query).then(() => {
					resolve(null);
				})
				.catch(function(error) {
					reject(error);

				});
			});

		}

		return new Promise(function(resolve, reject) {

			Promise.resolve().then(() => {
				return deleteFromStocks(symbol);
			})
			.then(() => {
				return deleteFromQuotes(symbol);
			})
			.then(() => {
				resolve(null);
			})
			.catch((error) => {
				resolve(null);
			})
		});

	}



	function getSymbols() {

		var sql = 'SELECT symbol FROM stocks';

		return new Promise(function(resolve, reject) {

			_db.query(sql).then(function(rows) {

				var symbols = [];

				rows.forEach(function(row) {
					if (!isString(_argv.symbol) || row.symbol.match(_argv.symbol)) {
						symbols.push(row.symbol);
					}
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
						reject(error);

					});
				});

				promise.then(function() {
					resolve(quotes);
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

			function fetchFromYahoo(symbol, from, to) {

				return new Promise(function(resolve, reject) {
					var options = {};

					options.symbol = symbol;
					options.from   = from;
					options.to     = to;

					var quotes = [];

					yahoo.historical(options).then(function(items) {

						items.forEach(function(item) {
							if (isValidQuote(item)) {
								var quote = {};

								quote.date   = item.date;
								quote.symbol = item.symbol;
								quote.open   = round(item.open);
								quote.high   = round(item.high);
								quote.low    = round(item.low);
								quote.close  = round(item.close);
								quote.volume = item.volume;
	
								quotes.push(quote);
	
							}
						});

						resolve(quotes);
					})
					.catch((error) => {
						reject(error);
					})


				});
			}

			function isValidQuote(quote) {
				return quote && quote.open != null && quote.close != null && quote.high != null && quote.low != null;
			}



			function fetch(symbol, from, to) {

				from = new Date(from.getFullYear(), from.getMonth(), from.getDate());
				to = new Date(to.getFullYear(), to.getMonth(), to.getDate());

				return new Promise(function(resolve, reject) {

					var now = new Date();
					var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

					if (today - from <= 0) {
						console.log(sprintf('Skipping quotes for %s from %s to %s...', symbol, dateToString(from), dateToString(to)));
						return resolve(null);
					}

					console.log(sprintf('Fetching quotes for %s from %s to %s...', symbol, dateToString(from), dateToString(to)));

					Promise.resolve().then(() => {
						return fetchFromYahoo(symbol, from, to);
					})
					.catch((error) => {
						if (error.message.search('Failed to get crumb') >= 0) {
							console.warn(sprintf('Failed to fetch quotes for symbol %s from Yahoo. Removing symbol.', symbol));
							return deleteSymbol(symbol);
						}
						else {
							return Promise.resolve([]);
						}
					})
					.then((quotes) => {
						resolve(quotes);
					})
					.catch((error) => {
						reject(error);
					})
				});
			}

			if (!isArray(symbols))
				symbols = [symbols];

			var promise = Promise.resolve();
			var symbolsUpdated = 0;
			var counter = 0;
			var now = new Date();

			var startDates = {};

			if (to == undefined)
				to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

			if (from == undefined) {
				promise = getStartDates().then((dates) => {
					startDates = dates;
				});
			}

			symbols.forEach(function(symbol) {

				var time = undefined;

				promise = promise.then(() => {
					time = new Date();

					var startDate = from;
					var endDate   = to;

					if (startDate == undefined)
						startDate = startDates[symbol];

					if (startDate == undefined) {
						startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
						startDate.setDate(startDate.getDate() - 380);
					}

					return fetch(symbol, startDate, endDate);
				})
				.then((quotes) => {
					if (isArray(quotes) && quotes.length > 0) {
						symbolsUpdated++;
						console.log('Fetched %d quote(s) for symbol %s.', quotes.length, symbol);

						return upsert(quotes);
					}
					else {
						return Promise.resolve(quotes);
					}
				})
				.then((quotes) => {
					if (quotes)
						return updateStock(symbol);
					else
						return Promise.resolve();

				})
				.then(() => {
					if (time != undefined) {
						var now = new Date();
						console.log(sprintf('Symbol %s finished in %.1f seconds.', symbol, (now - time) / 1000));	
					}
					return Promise.resolve();

				})
				.then(() => {

					return delay(0);

					if ((++counter % 10) == 0) {
						console.log('Pausing for %s seconds...', _argv.pause);
						return delay(_argv.pause * 1000);
					}
					else {
						return delay(0);
					}
				})
			});

			promise.then(function() {
				resolve(symbolsUpdated);
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

					if (symbols.length == 0) {
						throw new Error('No symbols found.');
					}

					var from = undefined;
					var to = undefined;
					var now = new Date();

					if (_argv.since) {
						from = new Date(_argv.since);
					}

					if (_argv.days) {
						from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
						from.setDate(from.getDate() - _argv.days);
					}

					if (_argv.from) {
						from = new Date(_argv.from);
					}

					if (_argv.to) {
						to = new Date(_argv.to);
					}

					if (to == undefined)
						to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

					download(symbols, from, to).then(function(count) {
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

			console.info('Downloading quotes.');

			Promise.resolve().then(function() {
				return mysql.connect();
			})
			.then(function(db) {
				_db = db;
				return process();
			})
			.then(function(count) {
				console.info(sprintf('Finished downloading quotes. A total of %d symbol(s) downloaded and updated.', count));
			})
			.catch(function(error) {
				console.error(error.stack);
			})
			.then(function() {
				_db.end();
				resolve();
			});
		});
	}


	function schedule(cron) {

		return new Promise(function(resolve, reject) {
			try {
				var Schedule = require('node-schedule');
				var running  = false;

				console.info(sprintf('Scheduling to run download-quotes at cron-time "%s"...', cron));

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
					}
				});

				if (job == null) {
					reject(new Error('Invalid cron time.'));
				}
				else {
					resolve();
				}

			}
			catch(error) {
				reject(error);
			}

		});

	}



	function run(argv) {

		try {
			_argv = argv;

			var promise = Promise.resolve();

			if (isString(_argv.schedule))
				promise = schedule(_argv.schedule);
			else
				promise = work();

			promise.catch(function(error) {
				console.error(error.stack);

			});

		}
		catch(error) {
			console.error(error.stack);
		}
	}

	module.exports.command  = ['download-quotes [options]', 'dq [options]'];
	module.exports.describe = 'Download historical data from Google Finance';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
