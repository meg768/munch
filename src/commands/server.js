#!/usr/bin/env node

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
var mysql = require('mysql');

var sprintf    = require('yow/sprintf');
var isString   = require('yow/is').isString;
var mkpath     = require('yow/fs').mkpath;

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


	function defineRoutes(app) {
		app.get('/hello', function (request, response) {
			response.status(200).json({status:'OK'});
		});

		app.get('/hello', function (request, response) {
			response.status(200).json({status:'OK'});
		});

		app.get('/query', function (request, response) {
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

		app.get('/stocks', function (request, response) {
			connect().then(function(db) {

				return query(db, 'SELECT * FROM stocks').then(function(rows) {
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
