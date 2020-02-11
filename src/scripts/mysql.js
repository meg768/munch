var fs       = require('fs');
var sprintf  = require('yow/sprintf');
var isString = require('yow/isString');
var mysql    = require('mysql');


var Module = module.exports = function() {

	var _this = this;
	var _connection = null;


	_this.connect = function() {

		return new Promise(function(resolve, reject) {
			_connection.connect(function(error) {
				if (error) {
					console.error('Error connecting: ' + error.stack);
					reject(error);
				}
				else {
					resolve(_this);

				}

			});
		});

	}


	_this.end = function() {
		_connection.end();
	}

	_this.query = function(options) {

		if (isString(options)) {
			options = {sql:options};
		}

		//console.log('Query:', options);

		return new Promise(function(resolve, reject) {

			var query = _connection.query(options, function(error, results, fields) {
				if (error)
					reject(error);
				else
					resolve(results, fields);
			});


		});
	}

	_this.format = function() {
		return mysql.format.apply(_this, arguments);
	}

	_this.upsert = function(table, row) {

		var values = [];
		var columns = [];

		Object.keys(row).forEach(function(column) {
			columns.push(column);
			values.push(row[column]);
		});

		var sql = '';

		sql += _this.format('INSERT INTO ?? (??) VALUES (?) ', [table, columns, values]);
		sql += _this.format('ON DUPLICATE KEY UPDATE ');

		sql += columns.map(function(column) {
			return _this.format('?? = VALUES(??)', [column, column]);
		}).join(',');

		//console.log('Upsert:', sql);
		return _this.query(sql);
	}


	function init() {
		console.log(sprintf('Connecting to %s@%s...', process.env.MYSQL_DATABASE, process.env.MYSQL_HOST));

		var options = {};
		options.host     = process.env.MYSQL_HOST;
		options.user     = process.env.MYSQL_USER;
		options.password = process.env.MYSQL_PASSWORD;
		options.database = process.env.MYSQL_DATABASE;

		if (!isString(options.host) || !isString(options.user) || !isString(options.password) || !isString(options.database)) {
			throw new Error('MySQL credentials/database not specified.');

		}
		_connection  = mysql.createConnection(options);
	}

	init();

}
