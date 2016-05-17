
var fs         = require('fs');
var Promise    = require('bluebird');
var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var fileExists = require('yow').fileExists;
var config     = require('../scripts/config.js');
var sqlite3    = require('sqlite3');





var Simulation = module.exports = function(args) {

	var _this = this;
	var _sqlFile = config.simulation.sqlFile;
	
	if (!fileExists(_sqlFile)) {
		throw new Error(sprintf('File \'%s\' does not exist.', _sqlFile));
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
	
	function getQuotes(db, date) {
		
		return new Promise(function(resolve, reject) {
			
			var ymd = sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());
			var sql = sprintf('SELECT * FROM quotes WHERE date =\'%s\'', ymd);
			
			db.all(sql, function(error, rows) {
				
				if (error == null) {
					var quotes = {};
					
					rows.forEach(function(row) {
						if (quotes[row.time] == undefined)
							quotes[row.time] = {};
							
						quotes[row.time][row.symbol] = row;
					});
					
					resolve(quotes);
					
				}
				else
					reject(error);
			});
			
		});		
	};
	


	
	function runDate(db, date) {
		
		return new Promise(function(resolve, reject) {
			var startOfDay = new Date(date.getTime());
			
			startOfDay.setHours(9);
			startOfDay.setMinutes(30);
			startOfDay.setSeconds(0);
			startOfDay.setMilliseconds(0);
	
			// Set start time
			_this.time = new Date(startOfDay.getTime());
			
			// Reset quotes
			_this.data = {};
			
			
			getQuotes(db, _this.time).then(function(quotes) {
				_this.algorithm.onStartOfDay();			
				
				for (var minute = 0; minute <= 390; minute++) {
					// Set new time
					_this.time = new Date(startOfDay.getTime() + minute * 1000 * 60);
		
					// Build up the key (HH:MM)
					var timeKey = sprintf('%02d:%02d', _this.time.getHours(), _this.time.getMinutes());
					
					// Extend the data with minute data
					extend(_this.data, quotes[timeKey]);
		
					_this.algorithm.onData();
				}
		
				_this.algorithm.onEndOfDay();
				
				resolve();			
				
			}).catch(function(){
				reject();
			});
			
			
		});
	}
	
	this.run = function() {
		
		console.log(sprintf('Starting simulation...'));
		console.log('Initializing engine.');

		var db = new sqlite3.Database(_sqlFile);
		
		_this.config  = loadConfig();
		_this.time    = null;
		_this.data    = {};
		_this.stocks  = getStocks(db);
		
		console.log(sprintf('Loading algorithm \'%s\'...', args.algo));
		_this.algorithm = loadAlgorithm();
		console.log('Done.');
				
		getStocks().then(function(stocks) {
			_this.stocks = stocks;

			_this.algorithm.onStartOfAlgorithm();		
	
			_this.dates.forEach(function(date) {
	
				var startOfDay = new Date(date.getTime());
				
				startOfDay.setHours(9);
				startOfDay.setMinutes(30);
				startOfDay.setSeconds(0);
				startOfDay.setMilliseconds(0);
	
				// Set start time
				_this.time = new Date(startOfDay.getTime());
				
				getQuotes(db, _this.time).then(function(quotes) {
					_this.algorithm.onStartOfDay();			
					
					for (var minute = 0; minute <= 390; minute++) {
						// Set new time
						_this.time = new Date(start.getTime() + minute * 1000 * 60);
		
						// Extend the data with minute data
						extend(_this.data, store.getQuotes(_this.time));
		
						algorithm.onData();			
						
					}
		
					algorithm.onEndOfDay();			
					
				});
	
			});
	
			algorithm.onEndOfAlgorithm();		
			
		});

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


