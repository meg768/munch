#!/usr/bin/env node

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
var mysql = require('mysql');

var sprintf    = require('yow/sprintf');
var isString   = require('yow/is').isString;
var mkpath     = require('yow/fs').mkpath;
var yahoo      = require('yahoo-finance');

var Module = new function() {

	var _argv = undefined;
	var _mysql = undefined;

	function defineArgs(args) {


		args.usage('Usage: $0 [options]');
		args.option('help',     {alias:'h', describe:'Displays this information'});
		args.option('port',     {alias:'p', describe:'Specifies port', default:3012});

		args.wrap(null);

		args.check(function(argv) {

			return true;
		});

		return args.argv;
	}

	function connect() {
		return new Promise(function(resolve, reject) {
			_mysql.getConnection(function(error, connection) {
				if (!error)
					resolve(connection);
				else
					reject(error);
			});
		});
	}

	function query(db, options) {
		return new Promise(function(resolve, reject) {

			if (isString(options)) {
				options = {sql:options}
			}

			console.log('Running query', options);

			db.query(options, function (error, results, fields) {
				if (!error)
					resolve(results);
				else
					reject(error);
			});
		});
	}

	function upsert(db, table, row) {

		var values = [];
		var columns = [];

		Object.keys(row).forEach(function(column) {
			columns.push(column);
			values.push(row[column]);
		});

		var sql = '';

		sql += db.format('INSERT INTO ?? (??) VALUES (?) ', [table, columns, values]);
		sql += db.format('ON DUPLICATE KEY UPDATE ');

		sql += columns.map(function(column) {
			return db.format('?? = VALUES(??)', [column, column]);
		}).join(',');

		return query(db, sql);
	}


	function defineRoutes(app) {
		app.get('/hello', function (request, response) {
			response.status(200).json({status:'OK'});
		});

		app.get('/lookup', function (request, response) {
			var options = Object.assign({}, request.body, request.query);

			if (isString(options)) {
				options = {symbol:options};
			}

			var yahooOptions = {};

			yahooOptions.symbol = options.symbol;
			yahooOptions.modules = ['price', 'summaryProfile'];

			yahoo.quote(yahooOptions).then((data) => {
				console.log(data);
				var json = {};
				json.symbol = data.price.symbol;
				json.name = data.price.longName ? data.price.longName : data.price.shortName;
				json.sector = data.summaryProfile ? data.summaryProfile.sector : 'n/a';
				json.industry = data.summaryProfile ? data.summaryProfile.industry : 'n/a';
				json.exchange = data.price.exchangeName;
				json.type = data.price.quoteType.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

				// Fix some stuff
				json.name = json.name.replace(/&amp;/g, '&');

				response.status(200).json(json);
			})
			.catch((error) => {
				response.status(404).json(error);
			});

		});

		app.get('/query', function (request, response) {


			console.warn('Method /query depricated. Please use /mysql instead. Mvh MEG.');

			connect().then(function(db) {

				var options = Object.assign({}, request.body, request.query);

				if (isString(options)) {
					options = {sql:options};
				}

				return query(db, options).then(function(rows) {
					db.release();
					return Promise.resolve(rows);
				})
				.catch(function(error) {
					db.release();
					throw error;
				})
			})
			.then(function(rows) {
				response.status(200).json(rows);
			})
			.catch(function(error) {
				console.error(error);
				response.status(404).json(error);

			});
		});

		app.get('/mysql', function (request, response) {
			connect().then(function(db) {

				var options = Object.assign({}, request.body, request.query);

				if (isString(options)) {
					options = {sql:options};
				}

				return query(db, options).then(function(rows) {
					db.release();
					return Promise.resolve(rows);
				})
				.catch(function(error) {
					db.release();
					throw error;
				})
			})
			.then(function(rows) {
				response.status(200).json(rows);
			})
			.catch(function(error) {
				console.error(error);
				response.status(404).json(error);

			});
		});



		app.get('/stock/:symbol', (request, response) => {
			connect().then((db) => {

				try {
					var options = {};
					options.sql = 'SELECT * FROM stocks WHERE symbol = ?';
					options.values = [request.params.symbol];

					return query(db, options).then((rows) => {
						return rows.length > 0 ? rows[0] : {};
					})
					.catch((error) => {
						throw error;
					});
				}
				catch(error) {
					throw error;
				}
				finally {
					db.release();
				}
			})
			.then((result) => {
				response.status(200).json(result);
			})
			.catch((error) => {
				response.status(404).json({error:error.stack});
			});

		});

		app.post('/stock', (request, response) => {
			connect().then((db) => {

				try {
					var args = Object.assign({}, request.body, request.query);

					return upsert(db, 'stocks', args).then((result) => {
						return Promise.resolve();
					})
					.then(() => {
						var options = {};
						options.sql = 'SELECT * FROM ?? WHERE ?? = ?';
						options.values = ['stocks', 'symbol', args.symbol];
						return query(db, options);
					})
					.then((rows) => {
						return rows.length > 0 ? rows[0] : {};
					})
					.catch((error) => {
						throw error;
					});
				}
				catch(error) {
					throw error;
				}
				finally {
					db.release();
				}
			})
			.then((result) => {
				response.status(200).json(result);
			})
			.catch((error) => {
				response.status(404).json({error:error.stack});
			});

		});

		app.get('/stock', (request, response) => {
			connect().then((db) => {

				try {
					var args = Object.assign({}, request.body, request.query);

					if (!isString(args.symbol)) {
						throw new Error('Symbol needed.');
					}

					var options = {};
					options.sql = 'SELECT * FROM stocks WHERE symbol = ?';
					options.values = [args.symbol];

					return query(db, options).then((rows) => {
						return rows.length > 0 ? rows[0] : {};
					})
					.catch((error) => {
						throw error;
					});

				}
				catch(error) {
					throw error;
				}

				finally {
					db.release();
				}
			})
			.then((result) => {
				response.status(200).json(result);
			})
			.catch((error) => {
				response.status(404).json({error:error.stack});
			});

		});

		app.get('/stocks', function (request, response) {
			connect().then((db) => {

				try {
					var args = Object.assign({}, request.body, request.query);

					var options = {};
					options.sql = 'SELECT * FROM stocks';

					return query(db, options).then((rows) => {
						return rows;
					})
					.catch((error) => {
						throw error;
					});

				}
				catch(error) {
					throw error;
				}

				finally {
					db.release();
				}
			})
			.then((result) => {
				response.status(200).json(result);
			})
			.catch((error) => {
				response.status(404).json({error:error.stack});
			});

		});

	}

	function run(argv) {

		_argv = argv;


		Promise.resolve().then(function() {

			console.log('Connecting to MySQL...');

			var options = {};
			options.host = process.env.MYSQL_HOST;
			options.user = process.env.MYSQL_USER;
			options.password = process.env.MYSQL_PASSWORD;
			options.database = process.env.MYSQL_DATABASE;

			_mysql = mysql.createPool(options);

		})
		.then(function() {
			console.log('Initializing service...');

			app.set('port', (argv.port || 3000));
			app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
			app.use(bodyParser.json({limit: '50mb'}));
			app.use(cors());

			defineRoutes(app);

			app.listen(app.get('port'), function() {
				console.log("Munch service is running on port " + app.get('port'));
			});

		})
		.catch(function(error) {
			console.error(error.stack);

		});

	}


	module.exports.command  = 'server [options]';
	module.exports.describe = 'Run munch server';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;

};
