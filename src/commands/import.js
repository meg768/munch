/*
	
Finished imports:

2016-04-14
2016-04-26
2016-04-27
2016-04-28
2016-04-29
2016-05-02
2016-05-03
	
*/

var fs          = require('fs');
var sprintf     = require('yow').sprintf;
var mkdir       = require('yow').mkdir;
var fileExists  = require('yow').fileExists;

var config  = require('../scripts/config.js');
var stocks  = require('../scripts/stocks.js');

var sqlite3 = require('sqlite3').verbose();




var Module = module.exports = function(args) {

	var _downloadFolder  = config.import.downloadFolder;
	var _sqliteFolder    = config.import.sqliteFolder;
	var _sqlFile         = sprintf('%s/%s', _sqliteFolder, 'sqlite.db');

	if (_sqliteFolder == undefined) {
		throw new Error('Must specify sqlite folder.');
		
	}
	if (!fileExists(_downloadFolder)) {
		throw new Error('The download folder does not exist');
	}

	
	function insertQuote(db, quote) {

		var insertSQL = 'INSERT INTO quotes (symbol, date, time, open, high, low, close, volume) VALUES($symbol, $date, $time, $open, $high, $low, $close, $volume)';
		var deleteSQL = 'DELETE FROM quotes WHERE symbol = $symbol AND date = $date AND time = $time'; 


		db.serialize(function() {
			var data = {};
			
			data.$symbol = quote.symbol;
			data.$date   = quote.date;
			data.$time   = quote.time;
			data.$open   = quote.open;
			data.$high   = quote.high;
			data.$low    = quote.low;
			data.$close  = quote.close;
			data.$volume = quote.volume;
			
			db.run(deleteSQL, {$symbol:quote.symbol, $date:quote.date, $time:quote.time});
			db.run(insertSQL, data);
		});

	}
		
	function ImportFile(db, date, symbol) {
		
		var fileName = sprintf('%s/%s/%s.json', _downloadFolder, date, symbol);
		
		if (!fileExists(fileName)) {
			console.warn(sprintf('File %s does not exist.', fileName));
			return undefined;			
		}
			
		var content = JSON.parse(fs.readFileSync(fileName));
		
		if (content != undefined) {
			db.serialize(function() {

				var count = 0;
				
				db.run('BEGIN');
				
				for (var key in content) {
					var item = content[key];
					
					var quote = {};
					quote.symbol = symbol;
					quote.date   = date;
					quote.time   = key;
					quote.open   = item.open;
					quote.high   = item.high;
					quote.low    = item.low;
					quote.close  = item.close;
					quote.volume = item.volume;
					
					insertQuote(db, quote);
					count++;	 
				}
				
				db.run('COMMIT', function() {
				});
				
				console.log(sprintf('Updated %s with %d quotes from %s.', symbol, count, date));
				
			});
			
			
		}
	}
	
	function ImportDate(db, date) {

		console.log(sprintf('Importing %s...', date));

		var path = sprintf('%s/%s', _downloadFolder, date);

		if (fileExists(path)) {

			var symbols = [];
			
			fs.readdirSync(path).filter(function(file) {
			
				var match = file.match('^(.*).json$');
				
				if (match) {
					symbols.push(match[1]);
				}
			});
			
			symbols.forEach(function(symbol) {
				ImportFile(db, date, symbol);
				
			});			
		}
	}

	this.run = function() {
		console.log(sprintf('Importing to \'%s\'...', _sqlFile));

		var newDB = !fileExists(_sqlFile);
		var db = new sqlite3.Database(_sqlFile);

		db.serialize(function() {
			if (args.date) {
				if (args.symbol)
					ImportFile(db, args.date, args.symbol);
				else
					ImportDate(db, args.date);
				
			}
	
			
		});
			
		
		console.log('Done.');
	}


};




