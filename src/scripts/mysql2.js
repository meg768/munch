var fs       = require('fs');
var sprintf  = require('yow').sprintf;
var isString = require('yow').isString;
var mysql    = require('mysql');

/*
host     : '104.199.12.40',
user     : 'root',
password : 'potatismos',
database : 'munch'
*/

var Connection = function(connection) {

	var _this = this;
	var _connection = connection;

	_this.release = function() {
		_connection.release();
	}

	_this.query = function(options) {

		if (isString(options)) {
			options = {sql:options};
		}


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
		return mysql.format.apply(this, arguments);
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

		return _this.query(sql);
	}
}



var Pool = module.exports = function(options) {

	var _this = this;
	var _pool = mysql.createPool(options);

	_this.connect = function() {

		return new Promise(function(resolve, reject) {
			_pool.getConnection(function(error, connection) {
				if (error) {
					console.error('Error connecting: ' + error.stack);
					reject(error);
				}
				else {
					resolve(new Connection(connection));
				}
			});
		});
	}


	_this.disconnect = function() {
		_pool.end();
	}



}