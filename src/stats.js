var fs = require('fs');
var sprintf = require('../lib/sprintf.js');

var Module = module.exports = function(folder) {
	

	var _this = this;
	
	_this.stocks = {};
	_this.sectors = {};
	_this.symbols = [];


	_this.getQuotes = function(symbol) {
		
		var quotes = [];
		var path = sprintf('%s/%s', folder, symbol);
		var files = fs.readdirSync(path);
		
		for (var index in files) {
			var match = files[index].match('^([0-9]{4}-[0-9]{2}-[0-9]{2}).json$');
			
			if (match)
				quotes.push(match[1]);

		}

		return quotes;
	}


	function getStock(symbol) {
		var path = sprintf('%s/tickers/%s.json', folder, symbol);
		var stock = JSON.parse(fs.readFileSync(path));

		return stock;
	}

	function getSymbols() {

		var path = sprintf('%s/tickers', folder);		
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

		var symbols = getSymbols();
		var stocks = {};
		var sectors = {};
		
		for (var index in symbols) {
			var symbol = symbols[index];
			stocks[symbol] = getStock(symbol);	
		}
		
		for (var key in stocks) {
			var stock = stocks[key];
			
			if (sectors[stock.sector] == undefined)
				sectors[stock.sector] = {};
			
			sectors[stock.sector][stock.symbol] = stock;

		}
		_this.symbols = symbols;
		_this.stocks = stocks;
		_this.sectors = sectors;

		console.log('Done.');

	}

	init();
}


	var module = new Module('./stocks');
	//console.log(module.getQuotes('TSLA'));
	

	console.log(module.sectors);
	//console.log(module.symbols);


