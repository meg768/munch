

var fs          = require('fs');
var sprintf     = require('yow').sprintf;
var mkdir       = require('yow').mkdir;
var fileExists  = require('yow').fileExists;

var config  = require('../scripts/config.js');
var stocks  = require('../scripts/stocks.js');

var sqlite3 = require('sqlite3').verbose();




var Module = module.exports = function(args) {

	var _downloadFolder  = config.transform.downloadFolder;
	var _sqliteFolder    = './data/sqlite';
	var _sqlFile         = sprintf('%s/%s', _sqliteFolder, 'sqlite.db');

	mkdir(_sqliteFolder);

	if (!fileExists(_downloadFolder)) {
		throw new Error('The download folder does not exist');
	}

	

	
	function readQuote(date, time, symbol) {
		var quote = {};
		quote.symbol = symbol;
		
		var fileName = sprintf('%s/%s/%s.json', _downloadFolder, date, symbol);
		
		if (!fileExists(fileName))
			return undefined;
			
		var json = JSON.parse(fs.readFileSync(fileName))[time];

		if (json == undefined)
			return undefined;
			
		var quote = {};
		quote.open   = json.open;
		quote.high   = json.high;
		quote.low    = json.low;
		quote.close  = json.close;
		quote.volume = json.volume;
		
		//console.log(JSON.stringify(quote));
		return quote;
	}
	
	function convertDateTime(db, date, time) {

		var insertSQL = 'INSERT INTO quotes (symbol, date, time, open, high, low, close, volume) VALUES($symbol, $date, $time, $open, $high, $low, $close, $volume)';
		var deleteSQL = 'DELETE FROM quotes WHERE symbol = $symbol AND date = $date AND time = $time'; 


		db.run('BEGIN TRANSACTION');

		for (var symbol in stocks) {
			var quote = readQuote(date, time, symbol);
			
			if (quote != undefined) {
				var data = {};
				
				data.$symbol = symbol;
				data.$date   = date;
				data.$time   = time;
				data.$open   = quote.open;
				data.$high   = quote.high;
				data.$low    = quote.low;
				data.$close  = quote.close;
				data.$volume = quote.volume;
				
				db.run(deleteSQL, {$symbol:symbol, $date:date, $time:time});
				db.run(insertSQL, data);
			}
			
		}

		db.run('COMMIT');


		console.log(sprintf('Transformed %s %s.', date, time));

	}
	
	
	function convertDate(db, date) {

		var path = sprintf('%s/%s', _downloadFolder, date);
		
		if (fileExists(path)) {
			var startTime = new Date();
			
			startTime.setHours(9);
			startTime.setMinutes(30);
			startTime.setSeconds(0);
			startTime.setMilliseconds(0);
	
			for (var i = 0; i <= 390; i++) {
				var timeOfDay = new Date(startTime.getTime() + 1000 * i * 60);
				var time = sprintf('%02d:%02d', timeOfDay.getHours(), timeOfDay.getMinutes());
				
				convertDateTime(db, date, time);
			}
			
		}
	}

	function createTables(db) {
		console.log('Creating tables...');
		db.exec('CREATE TABLE "quotes" ("symbol" text NOT NULL, "date" text NOT NULL, "time" text NOT NULL, "open" real, "high" real, "low" real, "close" real, "volume" integer, PRIMARY KEY("symbol","date","time"))');
		db.exec('CREATE TABLE "stocks" ("symbol" text NOT NULL, "name" text NOT NULL, "sector" text, "industry" text, "exchange" text, "volume" text, PRIMARY KEY("symbol"))');

	}

	function importStocks(db) {
		
		var insertSQL = 'INSERT INTO stocks (symbol, name, sector, industry, exchange, volume) VALUES($symbol, $name, $sector, $industry, $exchange, $volume)';
		var deleteSQL = 'DELETE FROM stocks WHERE symbol = $symbol'; 
		
		db.run('BEGIN TRANSACTION');

		for (var symbol in stocks) {
			var stock = stocks[symbol];
			var data = {};
			
			data.$symbol   = stock.symbol;
			data.$name     = stock.name;
			data.$sector   = stock.sector;
			data.$industry = stock.industry;
			data.$exchange = stock.exchange;
			data.$volume   = stock.volume;
			
			db.run(deleteSQL, {$symbol:symbol});
			db.run(insertSQL, data);
		}

		db.run('COMMIT');
		
	}


	this.run = function() {
		console.log(sprintf('Importing to \'%s\'...', _sqlFile));

		var newDB = !fileExists(_sqlFile);
		var db = new sqlite3.Database(_sqlFile);

		if (newDB) {
			createTables(db);
		}
		
		if (args.stocks) {
			importStocks(db);
		}
	
		if (args.quotes) {
			
			var dates = [];
			
			if (args.date) {
				console.log(sprintf('Importing date %s.', args.date));
				dates = [args.date];
			}
			else {
				console.log('Importing all dates.');
				
				dates = fs.readdirSync(_downloadFolder).filter(function(file) {
					return file.match('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
				});
			}
			dates.forEach(function(date) {
				convertDate(db, date);
			});
			
		}	

		db.close();
		
		console.log('Done.');
	}


};




