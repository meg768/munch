

var fs          = require('fs');
var sprintf     = require('yow').sprintf;
var mkdir       = require('yow').mkdir;
var fileExists  = require('yow').fileExists;
var Promise     = require('bluebird');
var mysql       = require('mysql');

var Module = module.exports = function(args) {

	var _rootFolder       = args.root ? args.root : './data';
	var _quotesFolder     = sprintf('%s/downloads/quotes', _rootFolder);
	var _stocksFolder     = sprintf('%s/downloads/stocks', _rootFolder);

	if (!fileExists(_quotesFolder)) {
		throw new Error(sprintf('The folder %s does not exist', _quotesFolder));
	}

	if (!fileExists(_stocksFolder)) {
		throw new Error(sprintf('The folder %s does not exist', _stocksFolder));
	}

	function connect() {

		var connection  = mysql.createConnection({
			host     : '104.199.12.40',
			user     : 'root',
			password : 'potatismos',
			database : 'munch'
		});

		return new Promise(function(resolve, reject) {
			connection.connect(function(error) {
				if (error) {
					console.error('error connecting: ' + error.stack);
					reject(error);
				}

				console.log('connected as id ' + connection.threadId);

				resolve(connection);
			});
		});

	}


	function getStocks() {

		var stocks = [];

		fs.readdirSync(_stocksFolder).forEach(function(file) {
			var match = file.match('^(.+).json$');

			if (match) {
				var fileName = sprintf('%s/%s', _stocksFolder, file);
				stocks.push(JSON.parse(fs.readFileSync(fileName)));
			}

		});

		return stocks;
	}

	function createTables(db) {

		return new Promise(function(resolve, reject) {
			db.serialize(function() {
				db.run('BEGIN');
				db.run('CREATE TABLE IF NOT EXISTS "quotes" ("date" text NOT NULL, "time" text NOT NULL, "symbol" text NOT NULL, "open" real, "high" real, "low" real, "close" real, "volume" integer)');
				db.run('CREATE TABLE IF NOT EXISTS "stocks" ("symbol" text NOT NULL, "name" text NOT NULL, "sector" text, "industry" text, "exchange" text, "volume" text, "updated" text, "downloaded" text)');

				db.run('CREATE UNIQUE INDEX IF NOT EXISTS "date_time_symbol" ON quotes ("date" DESC, "time" DESC, "symbol" DESC)');
				db.run('CREATE UNIQUE INDEX IF NOT EXISTS "symbol" ON stocks ("symbol" DESC)');
				db.run('COMMIT', function(error) {
					if (!error)
						resolve();
					else
						reject(error);
				});

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

		});

	}


	function upsertQuote(db, quote) {
		return upsertRow(db, 'quotes', quote);
	}

	function upsertStock(db, stock) {
		return upsertRow(db, 'stocks', stock);
	}


	function importStocks(db) {
		var stocks = getStocks();

		return new Promise(function(resolve, reject) {

			var count = 0;

			return Promise.each(stocks, function(stock) {

				return upsertRow(db, 'stocks', stock).then(function() {

					var percent = Math.floor((count++ * 100) / stocks.length);

					if ((count % 100) == 0)
						console.log(sprintf('Importing %s - %s (%d%%)...', stock.symbol, stock.name, percent));


				});;
			})

			.then(function() {
				console.log(sprintf('%d stocks updated.', count));
				resolve();
			})

			.catch(function(error) {
				reject(error);
			});

		});

	}

	function importFile(db, date, symbol) {

		return new Promise(function(resolve, reject) {
			var fileName = sprintf('%s/%s/%s.json', _quotesFolder, date, symbol);

			if (fileExists(fileName)) {
				var content = JSON.parse(fs.readFileSync(fileName));

				if (content != undefined) {

					var count = 0;
					var quotes = [];

					for (var key in content) {
						var item = content[key];

						var quote = {};
						quote.symbol = symbol;
						quote.date   = date;
						quote.time   = key;
						quote.open   = item.open;
						quote.high   = item.high;
						quote.low    = item.low;
						quote.close  = item.close;
						quote.volume = item.volume;

						quotes.push(quote);
					}

					console.log(sprintf('Importing %d quotes for symbol %s at %s', quotes.length, symbol, date));


					return Promise.each(quotes, function(quote) {
						return upsertRow(db, 'quotes', quote).then(function() {
							count++;
						});;
					})

					.then(function() {
						console.log(sprintf('%d quotes updated.', count));
						resolve();
					})

					.catch(function(error) {
						reject(error);
					});
				}
				else
					reject(sprintf('File %s could not be read properly.', fileName));



			}
			else {
				reject(sprintf('File %s does not exist.', fileName));
			}

		});

	}


	function importDate(db, date) {

		return new Promise(function(resolve, reject) {
			console.log(sprintf('Importing quotes from %s...', date));

			var path = sprintf('%s/%s', _quotesFolder, date);

			if (fileExists(path)) {

				var files = [];
				var totalUpdates = 0;

				fs.readdirSync(path).forEach(function(file) {

					var match = file.match('^(.*).json$');

					if (match)
						files.push(match[1]);
				});


				return Promise.each(files, function(file) {
					return importFile(db, date, file).then(function(count) {
						totalUpdates += count;
					});;
				})

				.then(function() {
					console.log(sprintf('Import finished from %s. %d stocks updated with %d quotes.', date, files.length, totalUpdates));
					resolve(totalUpdates);
				})

				.catch(function(error) {
					reject(error);
				});

			}
			else {
				reject(sprintf('Path %s does not exist.', path));
			}

		});
	}

	function importAll(db) {

		return new Promise(function(resolve, reject) {

			console.log(sprintf('Importing all quotes.'));

			var files = [];

			fs.readdirSync(_quotesFolder).forEach(function(file) {

				var match = file.match('^([0-9]{4}-[0-9]{2}-[0-9]{2})$');

				if (match != null)
					files.push(match[1]);
			});


			return Promise.each(files, function(file) {
				return importDate(db, file);
			})

			.then(function() {
				resolve();
			})

			.catch(function(error){
				reject();
			});
		});

	}

	function initialize(db) {

		return new Promise(function(resolve, reject) {
			var promises = [];

			promises.push(createTables(db));
			promises.push(importStocks(db));

			return Promise.each(promises, function(promise) {
				return promise;
			})

			.then(function() {
				resolve();
			})
			.catch(function(error) {
				reject(error);
			});

		});

	}

	this.run = function() {
		console.log(sprintf('Reading from \'%s\'...', _quotesFolder));

		connect().then(function(db) {

			if (args.stocks) {
				importStocks(db).then(function() {
					console.log('Done');
				});
			}


			else if (args.date) {
				if (args.symbol) {
					importFile(db, args.date, args.symbol).then(function() {
						console.log(sprintf('Imported all quotes for %s.', args.symbol));
					})
					.catch(function(error) {
						console.error(error);
					});

				}
				else
					importDate(db, args.date).then(function() {
						console.log(sprintf('Imported all quotes for %s.', args.date));

					})
					.catch(function(error) {
						console.error(sprintf('%s', error));

					});

			}
			else {

				importAll(db).then(function() {
					console.log(sprintf('Imported all.'));

				})
				.catch(function(error) {
					console.error(sprintf('%s', error));

				});
			}


		})
		.catch(function(error) {
			console.error(error);
		});
	}


};
