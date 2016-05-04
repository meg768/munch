var fs = require('fs');
var sprintf = require('../lib/sprintf.js');

var Module = module.exports = function(folder) {
	

	var _this = this;
	
	_this.symbols = {};
	_this.sectors = {};


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


	function init() {
		console.log('Loading quotes...');
		
		var symbols = fs.readdirSync(folder).filter(function(item) {
			return item[0] != '.';
		});

		for (var index in symbols) {
			var symbol = symbols[index];
			
			var stockFile = sprintf('%s/%s/%s.json', folder, symbol, symbol);
			var content = fs.readFileSync(stockFile, {encoding:'UTF8'})
			var stock   = JSON.parse(content);
			
			_this.symbols[symbol] = stock;

			if (_this.sectors[stock.sector] == undefined) {
				_this.sectors[stock.sector] = {};
			};
			
			_this.sectors[stock.sector][stock.symbol] = stock;
			
		}
		console.log('Done.');

	}

	init();
}


	var module = new Module('/Volumes/QUOTES/quotes');
	console.log(module.getQuotes('TSLA'));
	
	for (var key in module.sectors) {
		console.log(key);
	}
	console.log(module.sectors['Finance']);
	//console.log(module.symbols);


