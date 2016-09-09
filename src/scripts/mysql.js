var fs       = require('fs');
var sprintf  = require('yow').sprintf;
var isString = require('yow').isString;

var Module = module.exports = function() {

	var _this = this;
	var _connection = null;

	_this.connect = function() {

		return new Promise(function(resolve, reject) {
			connection.connect(function(error) {
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
		
		return new Promise(function(resolve, reject) {
			var query = _connection.query(options, function(error, results) {
				if (error)
					reject(error);
				else
					resolve(results);
			});

			console.log(query.sql);

		});
	}

	_this.upsert = function(table, row) {

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

		return _this.query({sql:sql, values:[data]});
	}

	function init() {

		var mysql = require('mysql');

		_connection  = mysql.createConnection({
			host     : '104.199.12.40',
			user     : 'root',
			password : 'potatismos',
			database : 'munch_test'
		});
	}

	init();

}
