var fs       = require('fs');
var sprintf  = require('yow/sprintf');
var isString = require('yow/isString');
var mysql    = require('mysql');

class MySQL {

    constructor(options) {
        this.connection = undefined;
    }

    connect() {
        
		console.log(sprintf('Connecting to %s@%s...', process.env.MYSQL_DATABASE, process.env.MYSQL_HOST));

		let options = {};
		options.host     = process.env.MYSQL_HOST;
		options.user     = process.env.MYSQL_USER;
		options.password = process.env.MYSQL_PASSWORD;
		options.database = process.env.MYSQL_DATABASE;
		options.port     = process.env.MYSQL_PORT;

		if (!isString(options.host) || !isString(options.user) || !isString(options.password) || !isString(options.database)) {
			throw new Error('MySQL credentials/database not specified.');

		}

        this.disconnect();
		this.connection  = mysql.createConnection(options);
    }

    disconnect() {
        if (this.connection != undefined)
            this.connection.end();

        this.connection = undefined;
    }

    format() {
		return mysql.format.apply(this, arguments);
	}

    query(options) {
		if (isString(options)) {
			options = {sql:options};
		}

		return new Promise((resolve, reject) => {

			this.connection.query(options, function(error, results) {
				if (error)
					reject(error);
				else
					resolve(results);
			});
		});

    }

    upsert(table, row) {

		let values = [];
		let columns = [];

		Object.keys(row).forEach(function(column) {
			columns.push(column);
			values.push(row[column]);
		});

		let sql = '';

		sql += this.format('INSERT INTO ?? (??) VALUES (?) ', [table, columns, values]);
		sql += this.format('ON DUPLICATE KEY UPDATE ');

		sql += columns.map((column) => {
			return this.format('?? = VALUES(??)', [column, column]);
		}).join(',');

		return this.query(sql);

    }
}


module.exports = MySQL;