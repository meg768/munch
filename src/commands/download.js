
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');

var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var isString   = require('yow').isString;
var fileExists = require('yow').fileExists;
var mkdir      = require('yow').mkdir;

var Gopher  = require('rest-request');


var Module = module.exports = function(args) {

	var _stocksFolder   = './data/downloads/stocks';
	var _quotesFolder   = './data/downloads/quotes';
	var _fetchCount     = undefined;
	var _numberOfDays   = undefined;
	var _symbols        = getSymbols();
	
	if (args.count)
		_fetchCount = parseInt(args.count);
		
	if (args.days)
		_numberOfDays = parseInt(args.days);
		
	if (_numberOfDays == undefined) {
		console.warn('Number of days to download is not specified. Assuming 14.');
		_numberOfDays = 14;	
	}

	if (_numberOfDays > 14)
		_numberOfDays = 14;
		
	if (_fetchCount == undefined) {
		console.warn('Number of stocks to update not specified. Assuming 3.');
		_fetchCount = 3;	
	}
	

	function stringify(o) {
		return JSON.stringify(o, null, '\t');
	}	
	
	function getSymbols() {
		
		var symbols = [];
		
		fs.readdirSync(_stocksFolder).forEach(function(file) {
			var match = file.match('^(.+).json$');

			if (match) {
				symbols.push(match[1]);
			}
			
		});
		
		return symbols;
	}
	
	function stockFileName(symbol) {
		return sprintf('%s/%s.json', _stocksFolder, symbol);
	}
	
	function symbolExists(symbol) {
		return fileExists(stockFileName(symbol));
	}
	
	this.run = function() {

		if (args.days)
			_numberOfDays = parseInt(args.days);
			
		if (isString(args.symbol)) {
			var symbol = args.symbol;
			
			if (symbolExists(symbol))
				fetchQuotes(symbol);
			else	
				console.log(sprintf('Symbol \'%s\' does not exist.', symbol));
		}
		else  {
			
			console.log(sprintf('Started downloading quotes to folder \'%s\'...', _quotesFolder));
	
			schedule();	
	
			
		}
	}

	function getSymbolsToUpdate() {

		var symbols = [];
		
		
		console.log('Checking if anything needs to be updated.');
		
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

		if (timestamps.length > 0) {
			console.log(sprintf('%d stocks needs an update...', timestamps.length));
		}
				
		// Only picks the first ones
		timestamps = timestamps.slice(0, _fetchCount);
		
		timestamps.forEach(function(timestamp) {
			symbols.push(timestamp.symbol);
		});

		if (symbols.length > 0 && symbols.length < 100) {
			console.log(sprintf('The following symbols will be updated: %s', symbols.join(', ')));
		}
		
		return symbols;
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
		
		console.log(sprintf('Fetch count is set to %d every %d second(s) and fetching %d days of quotes.', _fetchCount, delay, _numberOfDays));
		
		function runOnce() {

			return new Promise(function(resolve, reject) {
				var symbols  = getSymbolsToUpdate();
				 
				Promise.each(symbols, function(symbol) {
					return fetchQuotes(symbol);
				})
				
				.then(function() {
					resolve(symbols);
				})
				
				.catch(function(error) {
					reject(error);
				});
			});
		}	

		function loop() {
			runOnce().then(function(symbols) {
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
	

	// Fetches all timestamps for the stock file, if it doesn't exist, timestamp is from 1970.
	function getTimeStamps() {
	
		var timestamps = [];
			
		_symbols.forEach(function(symbol){
			var file = stockFileName(symbol);			

			if (!fileExists(file)) {
				timestamps.push({symbol:symbol, timestamp:new Date(0)});
			}
			else {
				var stat = fs.statSync(file);
				timestamps.push({symbol:symbol, timestamp:stat.mtime});
			}
		});

		return timestamps;
	}
	

	function fetchQuotes(symbol) {

		return new Promise(function(resolve, reject) {
			
			requestQuotes(symbol, _numberOfDays, 60).then(function(quotes) {
				try {
					var quotesUpdated = 0;
					
					for (var dateKey in quotes) {
						mkdir(sprintf('%s/%s', _quotesFolder, dateKey));
						
						var quoteFile = sprintf('%s/%s/%s.json', _quotesFolder, dateKey, symbol);
						fs.writeFileSync(quoteFile, JSON.stringify(quotes[dateKey], null, '\t'));
						quotesUpdated++;
					}
		
					var stockFile = stockFileName(symbol);
					var stock = JSON.parse(fs.readFileSync(stockFile));
					
					stock.updated = new Date();
					
					fs.writeFileSync(stockFile, JSON.stringify(stock, null, '\t'));
					console.log(sprintf('Updated %s at %s with %d day(s) of data.', symbol, dateKey, quotesUpdated));		
					
					resolve();	
					
				}
				catch(error) {
					console.error('Request failed.', error);			
					reject(error);	
				}
				
			})
	
			.catch(function(error, response, body) {
				console.error(sprintf('Failed loading %s', symbol));
				reject(error);
			});
			
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
			})
			.catch(function(error) {
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


