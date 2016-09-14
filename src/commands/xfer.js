
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var Progress = require('progress');

var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var isString   = require('yow').isString;
var fileExists = require('yow').fileExists;
var mkdir      = require('yow').mkdir;
var mkpath     = require('yow').mkpath;
var isInteger  = require('yow').isInteger;
var isDate     = require('yow').isDate;




var Module = module.exports = function(args) {



	function stringify(o) {
		return JSON.stringify(o, null, '\t');
	}




	function processTable(src, dst, sql, table, comment) {
		return new Promise(function(resolve, reject) {

			src.query(sql).then(function(rows) {


				var size    = Math.pow(10, Math.floor(Math.log10(rows.length)));
				var bucket  = Math.floor((rows.length / size));
				var total   = rows.length / bucket;
				var count   = 0;

				var progressTemplate = sprintf('Downloading %d rows for table %s [:bar] :percent :etas', rows.length, table);
 				var progress = new Progress(progressTemplate, {total:total});


				Promise.each(rows, function(row) {

				//	if ((count++ % bucket) == 0)
				//		progress.tick();

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

	function getAllDates(db) {
		return new Promise(function(resolve, reject) {

			db.query('select  distinct date from quotes order by date').then(function(rows) {

				var dates = rows.map(function(row){
					return row.date;
				});

				resolve(dates);
			})
			.catch(function(error) {
				reject(error);
			});
		});
	}

	function getNumberOfQuotesForDate(db, date) {
		return new Promise(function(resolve, reject) {

			var sql = db.format('select date, count(symbol) as count from quotes where date = ? group by date', [date]);

			db.query(sql).then(function(rows) {
				resolve(rows.length == 0 ? 0 : rows[0].count);
			})
			.catch(function(error) {
				reject(error);
			});
		});
	}

	function processCheck(src, dst) {

		function processDate(date) {
			return new Promise(function(resolve, reject) {

				getNumberOfQuotesForDate(src, date).then(function(srcCount) {
					getNumberOfQuotesForDate(dst, date).then(function(dstCount) {
						resolve({source:srcCount, destination:dstCount});
					})
					.catch(function(error) {
						reject(error);
					});

				})
				.catch(function(error) {
					reject(error);
				});
			});
		}

		return new Promise(function(resolve, reject) {

			getAllDates(src).then(function(dates) {


				Promise.each(dates, function(date) {
					return processDate(date).then(function(count) {
						console.log(sprintf('%s: %d/%d - %.1f%%', date.toLocaleDateString(), count.source, count.destination, count.destination / count.source * 100));
					})
					.catch(function(error) {
						reject(error);
					});

				})
				.then(function() {
					resolve();
				})
				.catch(function(error) {
					reject(error);
				});

			})
			.catch(function(error) {
				reject(error);

			});

		});

	}

	function processQuotes(src, dst, date) {

		return new Promise(function(resolve, reject) {

			if (isString(date))
				date = new Date();

			if (!isDate(date))
				reject('Must supply a date using --date.');

			else {
				date = sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());

				console.log(sprintf('Transferring quotes for %s...', date));
				var sql = src.format('SELECT * FROM quotes WHERE date = ?', [date]);

				processTable(src, dst, sql, 'quotes').then(function() {
					resolve();
				})
				.catch(function(error) {
					reject(error);

				});

			}
		});

	}


	function processAllQuotes(src, dst) {

		function processDate(date) {
			return new Promise(function(resolve, reject) {

				getNumberOfQuotesForDate(src, date).then(function(srcCount) {
					getNumberOfQuotesForDate(dst, date).then(function(dstCount) {
						if (srcCount != dstCount) {
							console.log(sprintf('Importing %s...', date.toLocaleDateString()));
							processQuotes(src, dst, date).then(function() {
								resolve();
							})
							.catch(function(error) {
								reject(error);
							});
						}
						else {
							console.log(sprintf('Skipping %s...', date.toLocaleDateString()));
							resolve();
						}
					})
					.catch(function(error) {
						reject(error);
					});

				})
				.catch(function(error) {
					reject(error);
				});
			});
		}

		return new Promise(function(resolve, reject) {

			getAllDates(src).then(function(dates) {

				if (args.reverse) {
					dates.sort(function(a, b) {
						return b.valueOf() - a.valueOf();
					});
				}

				Promise.each(dates, function(date) {
					return processDate(date).then(function(count) {
						//console.log(sprintf('%s: %d/%d - %.1f%%', date.toLocaleDateString(), count.source, count.destination, count.destination / count.source * 100));
					})
					.catch(function(error) {
						reject(error);
					});

				})
				.then(function() {
					resolve();
				})
				.catch(function(error) {
					reject(error);
				});

			})
			.catch(function(error) {
				reject(error);

			});

		});

	}
	function process(src, dst) {


		if (args.check)
			return processCheck(src, dst);
		if (args.stocks)
			return processStocks(src, dst);

		if (args.quotes) {
			if (isString(args.date)) {
				return processQuotes(src, dst, new Date(args.date));
			}

			if (args.all)
				return processAllQuotes(src, dst);

			return new Promise(function(resolve, reject) {
				reject('Specify --date or --all');
			});
		}

		return new Promise(function(resolve, reject) {
			reject('Nothing to do. Specify --check, --quotes or --stocks');
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
