var sprintf    = require('yow/sprintf');
var isArray    = require('yow/is').isArray;
var isString   = require('yow/is').isString;
var isDate     = require('yow/is').isDate;
var isInteger  = require('yow/is').isInteger;
var MySQL      = require('../scripts/mysql.js');
var yahoo      = require('yahoo-finance');


var Module = new function() {

	var _db = undefined;
	var _argv = undefined;

	function defineArgs(args) {

		args.option('symbol', {alias: 's', describe:'Download specified symbol only'});
		args.option('days',   {alias: 'd', describe:'Specifies number of days back in time to fetch'});
		args.option('since',  {alias: 'c', describe:'Fetch quotes since the specified date'});
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

			return true;
		});

	}



	function updateStatistics(symbol) {

		return new Promise(function(resolve, reject) {

			function computeSMA(quotes, days) {
				if (quotes.length < days)
					return null;

				var sum = 0;

				for (var index = 0; index < days; index++)
					sum += quotes[index].close;

				return (sum / days).toFixed(2);
			}

			function computeAV(quotes, days) {
				if (quotes.length < days)
					return null;

				var sum = 0;

				for (var index = 0; index < days; index++)
					sum += quotes[index].volume;

				return (sum / days).toFixed(0);
			}


			var query = {};
			query.sql = 'SELECT * FROM history WHERE symbol = ? ORDER BY date DESC LIMIT 200';
			query.values = [symbol];

			_db.query(query).then(function(quotes) {

				var row = {};

				row.symbol = symbol;
				row.SMA200 = computeSMA(quotes, 200);
				row.SMA50  = computeSMA(quotes, 50);
				row.SMA10  = computeSMA(quotes, 10);
				row.AV14   = computeAV(quotes, 14);

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

			function round(value) {
				return parseFloat(value).toFixed(4);
			}

			var promise = Promise.resolve();


			quotes.forEach(function(quote) {
				promise = promise.then(function() {
					var row = {};
					row.date   = quote.date;
					row.symbol = quote.symbol;
					row.open   = round(quote.open);
					row.high   = round(quote.high);
					row.low    = round(quote.low);
					row.close  = round(quote.close);
					row.volume = quote.volume;

					return _db.upsert('history', row);
				});
			});

			promise.then(function() {
				resolve(quotes.length);
			})
			.catch(function(error) {
				reject(error);
			});

		});

	}


	function download(symbols, from, to) {

		return new Promise(function(resolve, reject) {


			function fetch(symbol, from, to) {

				return new Promise(function(resolve, reject) {
					var options = {};
					options.symbol = symbol;
					options.from   = new Date(from);
					options.to     = new Date(to);

					yahoo.historical(options, function (error, quotes) {
						if (error)
							reject(error);
						else
							resolve(quotes);
					});

				});
			}

			console.log(sprintf('Fetching historical quotes from %s to %s...', from.toLocaleDateString(), to.toLocaleDateString()));

			if (!isArray(symbols))
				symbols = [symbols];

			var promise = Promise.resolve();

			symbols.forEach(function(symbol) {
				promise = promise.then(function() {
					return fetch(symbol, from, to);
				})
				.then(function(quotes) {
					console.log(sprintf('Updating %d quotes for \'%s\'...', quotes.length, symbol));
					return upsert(quotes);
				})
				.then(function() {
					console.log(sprintf('Updating stats for \'%s\'...', symbol));
					return updateStatistics(symbol);
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


	function run(argv) {

		try {
			_argv = argv;

			var mysql = new MySQL();

			mysql.connect().then(function(db) {

				_db = db;

				return process().then(function() {
					db.end();
					return Promise.resolve();
				})
				.catch(function(error) {
					db.end();
					return Promise.reject(error);
				})
			})

			.catch(function(error){
				console.log(error.stack);
			});


		}
		catch(error) {
			console.log(error.stack);
		}
	}

	module.exports.command  = 'yahoo [options]';
	module.exports.describe = 'Download historical data from Yahoo Finance';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
