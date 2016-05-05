var fs      = require('fs');
var sprintf = require('../lib/sprintf.js');
var config  = require('./config.js');

var Module = module.exports = function() {
	
	var _this = this;

	var _stockFolder = config.folders.stocks;
	var _quoteFolder = config.folders.quotes;
	
	_this.stocks  = {};
	_this.sectors = {};
	_this.symbols = [];

	function fileExists(path) {
		try {
			fs.accessSync(path);		
			return true;
		}
		catch (error) {
		}

		return false;		
	}
	
	_this.getQuotes = function(date) {
		
		var quotes = {};
		var path = sprintf('%s/%s', _quoteFolder, date);
		
		if (fileExists(path)) {
			var files = fs.readdirSync(path);
			
			for (var index in files) {
				var file  = files[index];
				var match = file.match('^([0-9A-Za-z]+).json$');
				
				if (match) {
					var symbol = match[1]; 
					var path = sprintf('%s/%s/%s', _quoteFolder, date, file);
					var quote = JSON.parse(fs.readFileSync(path));
					
					quotes[symbol] = quote;
					
				}
			}
		}

		return quotes;
	}


	function getStock(symbol) {
		var path = sprintf('%s/%s.json', _stockFolder, symbol);
		var stock = JSON.parse(fs.readFileSync(path));

		return stock;
	}
	
	function getStocks(symbols) {
		
		var stocks = {};
		
		for (var index in symbols) {
			var symbol = symbols[index];
			stocks[symbol] = getStock(symbol);	
		}		
		
		return stocks;
	}

	function getSectors(stocks) {
	
		var sectors = {};

		for (var key in stocks) {
			var stock = stocks[key];
			
			if (sectors[stock.sector] == undefined)
				sectors[stock.sector] = {};
			
			sectors[stock.sector][stock.symbol] = stock;

		}
		
		return sectors;
		
	}
	
	function getSymbols() {

		var path = sprintf('%s', _stockFolder);		
		var files = fs.readdirSync(path);
		var symbols = [];
		
		for (var index in files) {
			var file = files[index];
			var match = file.match('^([A-Za-z0-9]+).json$');
			
			if (match) {
				symbols.push(match[1]);
			}
		}
		
		return symbols;
	}

	function init() {
		console.log('Loading quotes...');

		var symbols   = getSymbols();
		var stocks    = getStocks(symbols);
		var sectors   = getSectors(stocks);
		
		_this.symbols = symbols;
		_this.stocks  = stocks;
		_this.sectors = sectors;

		console.log('Done.');

	}

	init();
}


