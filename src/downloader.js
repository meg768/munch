
var jsonfile = require('jsonfile');
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var schedule = require('node-schedule');

var Gopher  = require('../lib/gopher.js');
var sprintf = require('../lib/sprintf.js');
var utils   = require('../lib/utils.js');
var extend  = require('../lib/extend.js');


var Downloader = module.exports = function(stocks, stocksFolder, quotesFolder) {


	mkdir(stocksFolder);
	mkdir(quotesFolder);
	
	this.scheduleDownload = function() {
		
		log(sprintf('Started downloading quotes to \'%s\'...', quotesFolder));

		log(sprintf('Warming up...'));
		getTimeStamps();
		log(sprintf('Done.'));
		
		var rule = new schedule.RecurrenceRule();	
		rule.minute = new schedule.Range(0, 59, 1);

		schedule.scheduleJob(rule, function() {
			fetch(10);	
		});
	}

	function log(message) {
		var date = new Date();
		console.log(sprintf('%04d-%02d-%02d %02d:%02d:%02d: %s', date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), message));
	}	
	
	function fetch(blockSize) {
		var rule = new schedule.RecurrenceRule();	
		rule.second = new schedule.Range(0, 59, 1);

		log('Checking if anything to fetch...');
		
		var date = new Date();
		date.setDate(date.getDate() - 1);
		
		// Get all timestamps
		var timestamps = getTimeStamps();
		
		// Keep only the older ones
		timestamps = timestamps.filter(function(timestamp) {
			return timestamp.timestamp.getTime() < date.getTime();
		});
		
		// Sort ascending
		timestamps.sort(function(a, b) {
			return a.timestamp.getTime() - b.timestamp.getTime();
		});			
		
		// Only picks the first ones
		timestamps = timestamps.slice(0, blockSize);
		
		if (timestamps.length > 0) {
			
			var index = 0;
			var size = timestamps.length;
	
			var job = schedule.scheduleJob(rule, function() {
				
				var timestamp = timestamps[index++];
				
				if (timestamp != undefined) {
					var stock = stocks[timestamp.symbol];					
					log(sprintf('Fetching "%s" (%d/%d)...', stock.symbol, index, size));
					fetchQuote(stock);
				}
				else {
					log('Done.');
					job.cancel();
					
				}
			});
			
		}
		else {
			log('Nothing to fetch');
		}
		
	}

	// Fetches all timestamps for the stock file, if it doesn't exist, timestamp is from 1970.
	function getTimeStamps() {
	
		var timestamps = [];
			
		for (var symbol in stocks) {
			var stock = stocks[symbol];
			
			var stockFile = sprintf('%s/%s.json', stocksFolder, stock.symbol);

			if (!fileExists(stockFile)) {
				timestamps.push({symbol:stock.symbol, timestamp:new Date(0)});
			}
			else {
				var stat = fs.statSync(stockFile);
				timestamps.push({symbol:stock.symbol, timestamp:stat.mtime});
			}
				
		}	

		return timestamps;
	}
	
	function fetchQuote(stock) {

		var request = requestQuotes(stock.symbol, 3, 60);

		request.then(function(quotes) {
			
		
			for (var key in quotes) {
				mkdir(sprintf('%s/%s', quotesFolder, key));
				
				var quoteFile = sprintf('%s/%s/%s.json', quotesFolder, key, stock.symbol);
				fs.writeFileSync(quoteFile, JSON.stringify(quotes[key], null, '\t'));
			}

			var stockHeader = {};
			extend(stockHeader, stock, {updated: new Date()});

			// Update the stock header file after all quotes have been saved
			// The timestamp matters...
			var stockFile = sprintf('%s/%s.json', stocksFolder, stock.symbol);
			
			fs.writeFileSync(stockFile, JSON.stringify(stockHeader, null, '\t'));
			
			
		});

		request.catch(function(error, response, body) {
			console.error(response);
			log(sprintf('Failed loading %s', stock.symbol));
		});
		
	}

	function mkdir(path) {
		if (!fileExists(path)) {
			fs.mkdirSync(path);		
		}
		
	}


	function fileExists(path) {
		try {
			fs.accessSync(path);		
			return true;
		}
		catch (error) {
		}

		return false;		
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
				resolve(parseQuotes(symbol, result));
			});
			request.catch(function() {
				reject();
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
	
		var quotes = {};
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
	
				quote.close   = parseFloat(cols[1]);
				quote.high    = parseFloat(cols[2]);
				quote.low     = parseFloat(cols[3]);
				quote.open    = parseFloat(cols[4]);
				quote.volume  = parseInt(cols[5]);
				
				var dateKey = sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());
				var timeKey = sprintf('%02d:%02d', time.getUTCHours(), time.getUTCMinutes());
	
				if (quotes[dateKey] == undefined)
					quotes[dateKey] = {};
				 
				quotes[dateKey][timeKey] = quote;
			}
		})
	
		return quotes;
		
	}
	
};


