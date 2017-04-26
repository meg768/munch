var fs       = require('fs');
var sprintf  = require('yow').sprintf;
var isString = require('yow').isString;
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

		return _this.query(sql);
	}


	function init() {
		var options = {
			host     : '104.155.92.17',
			user     : 'root',
			password : 'potatismos',
			database : 'munch'
		};

		console.log(sprintf('Connecting to %s@%s...', options.database, options.host));

		_connection  = mysql.createConnection(options);
	}

	init();

}
