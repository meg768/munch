
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');

var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var isString   = require('yow').isString;
var fileExists = require('yow').fileExists;
var mkdir      = require('yow').mkdir;
var mkpath     = require('yow').mkpath;
var isInteger  = require('yow').isInteger;




var Module = module.exports = function(args) {



	function stringify(o) {
		return JSON.stringify(o, null, '\t');
	}




	function processTable(src, dst, sql, table) {
		return new Promise(function(resolve, reject) {

			src.query(sql).then(function(rows) {

				var count = 0;
				var percentComplete = -1;

				Promise.each(rows, function(row) {

					var percent = Math.floor((count++ * 100) / rows.length);

					if (percent != percentComplete) {
						console.log(sprintf('%d %% complete...', percentComplete = percent));

					}
					return dst.upsert(table, row);
				})

				.then(function() {
					resolve();
				})

				.catch(function(error) {
					reject(error);
				});
			})
			.catch(function(error) {
				reject();
			});
		});

	};



	function processStocks(src, dst) {

		return new Promise(function(resolve, reject) {

			processTable(src, dst, 'SELECT * FROM stocks', 'stocks').then(function() {
				resolve();
			})
			.catch(function(error) {
				reject(error);

			});
		});

	}

	function processQuotes(src, dst) {

		return new Promise(function(resolve, reject) {

			if (!isString(args.date))
				reject('Must supply a date using --date.');

			else {
				console.log(sprintf('Transferring quotes for %s...', args.date));
				var sql = sprintf('SELECT * FROM quotes WHERE date = \'%s\'', args.date);

				processTable(src, dst, sql, 'quotes').then(function() {
					resolve();
				})
				.catch(function(error) {
					reject(error);

				});

			}
		});

	}

	function process(src, dst) {

		if (args.stocks)
			return processStocks(src, dst);
		if (args.quotes)
			return processQuotes(src, dst);

		return new Promise(function(resolve, reject) {
			reject('Nothing to do. Specify --quotes or --stocks');
		});

	}


	function run() {

		var MySQL = require('../scripts/mysql.js');

		var srcDB = new MySQL({
			host     : '104.199.12.40',
			user     : 'root',
			password : 'potatismos',
			database : 'munch'
		});

		var dstDB = new MySQL({
			host     : '104.155.40.16',
			user     : 'root',
			password : 'potatismos',
			database : 'munch'
		});

		return new Promise(function(resolve, reject) {
			srcDB.connect().then(function(src) {

				dstDB.connect().then(function(dst) {
					process(src, dst).then(function() {
						resolve();
					})
					.catch(function(error) {
						reject(error);
					})
					.finally(function() {
						dst.end();
						src.end();
					});

				})
				.catch(function(error) {
					reject(error);
				})
			})
			.catch(function(error) {
				reject(error);
			});

		});


	}


	function schedule() {
		var delay = undefined;

		if (args.delay)
			delay = parseInt(args.delay);

		if (delay == undefined) {
			console.log('No --delay specified. Assuming 15 seconds');
			delay = 15;
		}

		if (delay < 1)
			delay = 1;

		function loop() {
			run().then(function(symbols) {
				if (symbols.length > 0)
					setTimeout(loop, delay * 1000);
				else {
					console.log('Nothing to to. Waiting for 5 minutes.');
					setTimeout(loop, 1000 * 60 * 5);

				}
			})
			.catch(function(error) {
				setTimeout(loop, 30 * 1000);
				console.log(error);
			});


		}

		loop();

	}


	this.run = function() {
		run().then(function(){}).catch(function(error) {
			console.log(error);
		});

	}

};
