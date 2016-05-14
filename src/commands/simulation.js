
var fs        = require('fs');
var sprintf   = require('tbx').sprintf;
var extend    = require('tbx').extend;
var config    = require('../scripts/config.js');


var Store = function(config) {


	var _this = this;
	var _quotesFolder = config.quotesFolder;
	var _stocksFolder = config.stocksFolder;

	
	if (!fileExists(_quotesFolder)) {
		throw new Error(sprintf('The quotes folder \'%s\' does not exist.', _quotesFolder));
	}

	if (!fileExists(_stocksFolder)) {
		throw new Error(sprintf('The stocks folder \'%s\' does not exist.', _stocksFolder));
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


	this.getSectors = function(stocks) {
	
		var sectors = {};

		for (var key in stocks) {
			var stock = stocks[key];
			
			if (sectors[stock.sector] == undefined)
				sectors[stock.sector] = {};
			
			sectors[stock.sector][stock.symbol] = stock;
		}
		
		return sectors;
	}	
	

	this.getDates = function() {
		
		var dates = [];
		
		fs.readdirSync(_quotesFolder).forEach(function(file) {
			var match = file.match('^([0-9]{4})-([0-9]{2})-([0-9]{2})$');
			
			if (match) {
				var date = new Date();
				
				date.setFullYear(parseInt(match[1]));
				date.setMonth(parseInt(match[2] - 1));
				date.setDate(parseInt(match[3]));
				date.setHours(0);
				date.setMinutes(0);
				date.setSeconds(0);
				date.setMilliseconds(0);
				
				dates.push(date);				
			}
		});
		
		dates.sort(function(a, b) {
			return new Date(b.date) - new Date(a.date);
		});
		
		return dates;
	}



	this.getSymbols = function() {

		var symbols = [];
		var path = sprintf('%s', _stocksFolder);
		
		fs.readdirSync(path).forEach(function(file) {
			var match = file.match('^(.+).json$');
			
			if (match) {
				symbols.push(match[1]);
			}
			
		});	
		
		return symbols;
	}


	this.getStocks = function(symbols) {

		var stocks = {};
		
		symbols.forEach(function(symbol) {
			var fileName = sprintf('%s/%s.json', _stocksFolder, symbol);		
			var stock    = JSON.parse(fs.readFileSync(fileName));
			
			stocks[symbol] = stock;	
		});	
		
		return stocks;
		
	};	

	this.getQuotes = function(date) {
		
		var quotes = {};
		var fileName = sprintf('%s/%04d-%02d-%02d/%02d.%02d.json', _quotesFolder, date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes());		

		if (fileExists(fileName)) {
			quotes = JSON.parse(fs.readFileSync(fileName));
		}
		else {
			console.warn(sprintf('Quote file \'%s\' does not exist.', fileName));
		}

		return quotes;
	}
	
};


var Portfolio = function() {

	var _this     = this;
	var _holdings = {};
	var _cash     = 100000;
	
	this.holdings = {};
	
	this.buy = function(symbol, price, quantity) {
		
		var item = _this.holdings[symbol];
		
		if (item == undefined) {
			item = {};
			item.price = price;
			item.quantity = quantity;

			_this.holdings[symbol] = item;
		}
		else {
			//item.quantity = item.quantity + quantity;
			//item.price    = 
		}
		
	}

	this.sell = function(symbol, price) {
		
	}

};


var Simulation = module.exports = function(args) {

	var _this = this;

	var _quotesFolder = config.simulation.quotesFolder;
	var _stocksFolder = config.simulation.stocksFolder;

	
	function fileExists(path) {
		try {
			fs.accessSync(path);		
			return true;
		}
		catch (error) {
		}

		return false;		
	}
	

	function loadAlgorithm() {
	
		if (!fileExists(sprintf('./src/algos/%s.js', args.algo))) {
			throw new Error(sprintf('Algorithm \'%s\' not found.', args.algo));
		}

		var moduleFile = sprintf('../algos/%s.js', args.algo);
		var module = require(moduleFile);
		
		return new module(_this);
	}

	function loadConfig() {
	
		var config = {};
		var configFile = sprintf('./src/algos/%s.json', args.algo);
		
		if (fileExists(configFile)) {
			config = JSON.parse(fs.readFileSync(configFile));
		}
		
		return config;
	}

	function saveConfig(config) {
	
		var configFile = sprintf('./src/algos/%s.json', args.algo);
		fs.writeFileSync(configFile, JSON.stringify(config, null, '\t'));
	}
	

	this.run = function() {
		
		
		console.log(sprintf('Starting simulation...'));
		console.log('Initializing engine.');

		var store = new Store({stocksFolder:_stocksFolder, quotesFolder:_quotesFolder});
		
		_this.config  = loadConfig();
		_this.time    = null;
		_this.data    = {};
		_this.symbols = store.getSymbols();
		_this.stocks  = store.getStocks(_this.symbols);
		_this.dates   = store.getDates();

		console.log('Done.');
		
		console.log(sprintf('Loading algorithm \'%s\'...', args.algo));
		var algorithm = loadAlgorithm();
		console.log('Done.');
				
		algorithm.onStartOfAlgorithm();		

		_this.dates.forEach(function(date) {

			var start = new Date(date.getTime());
			
			start.setHours(9);
			start.setMinutes(30);
			start.setSeconds(0);
			start.setMilliseconds(0);

			// Set start time
			_this.time = new Date(start.getTime());
			
			algorithm.onStartOfDay();			
			
			for (var minute = 0; minute <= 390; minute++) {
				// Set new time
				_this.time = new Date(start.getTime() + minute * 1000 * 60);

				// Extend the data with minute data
				extend(_this.data, store.getQuotes(_this.time));

				algorithm.onData();			
				
			}

			algorithm.onEndOfDay();			

		});

		algorithm.onEndOfAlgorithm();		

		saveConfig(_this.config);
		
		console.log('Done.');
	}
	
	function init() {
		if (typeof args.algo != 'string') {
			throw new Error('No algorithm defined. Use --algo.');
		}

		if (!fileExists(_quotesFolder)) {
			throw new Error('The quotes folder does not exist.');
		}
	
		if (!fileExists(_stocksFolder)) {
			throw new Error('The stocks folder does not exist.');
		}		

		
	}
	
	init();



};


