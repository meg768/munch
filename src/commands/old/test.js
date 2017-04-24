var sprintf = require('yow/sprintf');
var MySQL   = require('../scripts/mysql.js');


var Module = new function() {

	var _db = undefined;

	function defineArgs(args) {

		args.option('duration', {alias: 'd', describe:'Scan for the specified number of seconds', default:120});
		args.wrap(null);

	}


	function getMySQL() {

		var options = {
			host     : '104.155.92.17',
			user     : 'root',
			password : 'potatismos',
			database : 'munch'
		};

		return new MySQL(options);
	};

	function updateHistory(date, symbol) {
		return new Promise(function(resolve, reject) {

			var sql = '';

			sql += 'SELECT q1.date, '
			sql += _db.format('? AS symbol, ', [symbol]);
			sql += _db.format('(SELECT q1.open FROM quotes q1 LEFT JOIN quotes q2 ON (q1.date = q2.date AND q1.symbol = q2.symbol AND q1.time > q2.time) WHERE q1.symbol=? AND q1.date=? AND q2.time IS NULL) AS open, ', [symbol, date]);
			sql += _db.format('MAX(q1.high) as high, ');
			sql += _db.format('MIN(q1.low) as low, ');
			sql += _db.format('(SELECT q1.close FROM quotes q1 LEFT JOIN quotes q2 ON (q1.date = q2.date AND q1.symbol = q2.symbol AND q1.time < q2.time) WHERE q1.symbol=? AND q1.date=? AND q2.time IS NULL) AS close, ', [symbol, date]);
			sql += _db.format('SUM(q1.volume) AS volume ');
			sql += _db.format('FROM quotes q1  WHERE q1.symbol = ? AND q1.date= ? GROUP BY q1.date ', [symbol, date]);

			_db.query(sql).then(function(rows) {

				var promise = Promise.resolve();

				rows.forEach(function(row) {
					promise = promise.then(function() {
						return _db.upsert('history', row);
					});
				});

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

	function process() {

		return updateHistory('2017-01-13', 'AAPL');

		/*
		return new Promise(function(resolve, reject) {

			mysql.connect().then(function(db) {

				console.log('open');
				db.end();

				resolve(db);

			})
			.catch(function(error) {
				reject(error);
			});

		});
*/

	}


	function run(argv) {

		try {
			var mysql = getMySQL();

			mysql.connect().then(function(db) {

				_db = db;

				process(db).then(function() {
					console.log('Done');
					db.end();
				})
				.catch(function(error){
					console.log(error.stack);
					db.end();
				});
			})
			.catch(function(error) {
				console.log(error.stack);
			})

		}
		catch(error) {
			console.log(error.stack);
		}


	}

	module.exports.command  = 'test [options]';
	module.exports.describe = 'Scan the 433 MHz band for registerred devices';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
