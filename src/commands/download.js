
var jsonfile = require('jsonfile');
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var schedule = require('node-schedule');

var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var isString   = require('yow').isString;
var fileExists = require('yow').fileExists;

var Gopher  = require('rest-request');

var config  = require('../scripts/config.js');
var Promise = require('bluebird');
var sqlite3 = require('sqlite3');

var Module = module.exports = function(args) {


	var _fetchCount     = config.download.count;
	var _numberOfDays   = config.download.days;
	var _sqliteFolder   = config.download.sqliteFolder;
	var _sqlFile        = sprintf('%s/%s', _sqliteFolder, 'sqlite.db');
	

	if (args.count)
		_fetchCount = parseInt(args.count);
		
	if (args.days)
		_numberOfDays = parseInt(args.days);
		
	if (!fileExists(_sqlFile)) {
		throw new Error(sprintf('File \'%s\' does not exist.', _sqlFile));
	}
	if (_numberOfDays == undefined) {
		console.warn('Number of days to download is not specified. Assuming 15 days.');
		_numberOfDays = 15;	
	}

	if (_fetchCount == undefined) {
		console.warn('Number of stocks to update not specified. Assuming 10 days.');
		_fetchCount = 15;	
	}
	

		function getStocks(db) {
		
		return new Promise(function(resolve, reject) {
			db.all('SELECT * FROM stocks', function(error, rows) {
				
				if (error == null) {
					var stocks = [];
					
					rows.forEach(function(row) {
						stocks[row.symbol] = row;
					});
					
					resolve(stocks);
					
				}
				else
					reject(error);
			});
			
		});		
	};
	
	
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
		
			
	function getSymbolsToUpdate(stocks) {
	
		var timestamps = [];
		
		for (var symbol in stocks) {
			var stock = stocks[symbol];
			
			if (stock.updated == null) {
				timestamps.push({symbol:stock.symbol, timestamp:new Date(0)});
			}
			else {
				timestamps.push({symbol:stock.symbol, timestamp:new Date(stock.updated)});
			}
				
		}	

		var date = new Date();
		date.setDate(date.getDate() - 1);
		
		// Keep only the older ones
		timestamps = timestamps.filter(function(timestamp) {
			return timestamp.timestamp.getTime() < date.getTime();
		});
		
		// Sort ascending
		timestamps.sort(function(a, b) {
			return a.timestamp.getTime() - b.timestamp.getTime();
		});			

		if (timestamps.length == 0)
			return undefined;
			
		log(sprintf('%d stocks in need for an update...', timestamps.length));
		
		// Only picks the first ones
		timestamps = timestamps.slice(0, _fetchCount);
		
		var symbols = [];
		
		timestamps.forEach(function(timestamp) {
			symbols.push(timestamp.symbol);			
		});

		return symbols;
	}

	
	this.run = function() {

		var db = new sqlite3.Database(_sqlFile);
	

		getStocks(db).then(function(stocks) {
			
			var symbol = args.symbol;
			
			if (symbol == undefined) {
				getSymbolsToUpdate(stocks).forEach(function(symbol) {
					fetchQuotes(db, symbol);
				});
			}
			
			else if (isString(symbol)) {
				
				if (stocks[symbol] != undefined)
					fetchQuotes(db, symbol);
				else	
					log(sprintf('Symbol \'%s\' does not exist.', symbol));
			}
			else {
				/*
				log(sprintf('Started downloading quotes to folder \'%s\'...', _sqlFile));
		
				var rule = new schedule.RecurrenceRule();	
				rule.minute = new schedule.Range(0, 59, 1);
		
				schedule.scheduleJob(rule, function() {
					fetch();	
				});
				*/
				
			}
			
			
		});
	}

	function log(message) {
		console.log(message);
	}	

	

	
	function fetchQuotes(db, symbol) {

		var request = requestQuotes(symbol, _numberOfDays, 60);

		request.then(function(quotes) {
			try {
				db.serialize(function(){
	
					db.run('BEGIN');	
					
					quotes.forEach(function(quote) {
						insertQuote(db, quote);	
					});
	
					var now = new Date();				
					db.run('UPDATE stocks SET updated = ? WHERE symbol = ?', [now.toISOString(), symbol]);
					
					db.run('COMMIT', function(){ 
						console.log(sprintf('Committed %s.', symbol));
					});	
					
				});
				
				console.log(sprintf('Updated %s with %d quotes.', symbol, quotes.length));
			}
			catch(error) {
				console.error('Request failed.', error);				
			}
			
		});

		request.catch(function(error, response, body) {
			console.error(response);
			log(sprintf('Failed loading %s.', symbol));
		});
		
	}



	function requestQuotes(symbol, days, interval) {

		var gopher = new Gopher('http://www.google.com/finance');

		return new Promise(function(resolve, reject) {
			var params = {};
			params.q = symbol;
			params.i = interval;
			params.p = sprintf('%dd', days);
			params.f = 'd,o,h,l,c,v';
			
			var request = gopher.request('GET', 'getprices', params);
			
			request.then(function(result) {
				try {
					resolve(parseQuotes(symbol, result));
					
				}
				catch (error) {
					reject(error);
					
				};
			});
			request.catch(function(error) {
				reject(error);
			});
			
		});
	
	}

	function parseQuotes(symbol, text) {
	
		var rows = text.split('\n');
		
		var header = {};
		
		header.exchange       = rows.shift();
		header.marketOpen     = parseInt(rows.shift().split('=')[1]);
		header.marketClose    = parseInt(rows.shift().split('=')[1]);
		header.interval       = parseInt(rows.shift().split('=')[1]);
		header.columns        = rows.shift().split('=')[1].split(',');
		header.data           = rows.shift().split('=')[1];
		header.timezoneOffset = parseInt(rows.shift().split('=')[1]);
	
		var quotes = [];
		var date, time;
		
		rows.forEach(function(row) {
			var cols = row.split(',');
			
			if (cols.length == 6) {
				var quote = {};
				
				if (cols[0][0] == 'a') {
					date = new Date(parseInt(cols[0].substring(1)) * 1000);
					date = new Date(date.getTime() + 1000 * header.timezoneOffset * 60);
					time = date;			
				}	
				else {
					time = new Date(date.getTime() + 1000 * header.interval * parseInt(cols[0]));
				}
	
				var dateKey = sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());
				var timeKey = sprintf('%02d:%02d', time.getUTCHours(), time.getUTCMinutes());

				quote.symbol  = symbol;
				quote.date    = dateKey;
				quote.time    = timeKey;
				quote.close   = parseFloat(cols[1]);
				quote.high    = parseFloat(cols[2]);
				quote.low     = parseFloat(cols[3]);
				quote.open    = parseFloat(cols[4]);
				quote.volume  = parseInt(cols[5]);

				quotes.push(quote);				
	
			}
		})
	
		return quotes;
		
	}
	
};


