
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
	
		console.log(sprintf('Loading algorithm \'%s\'...', args.algo));
	
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
			var hm  = sprintf('%02d:%02d', date.getHours(), date.getMinutes());
			var sql = sprintf('SELECT * FROM quotes WHERE date =\'%s\' AND time = \'%s\'', ymd, hm);
			
			console.log(sprintf('Loading quotes for %s %s.', ymd, hm));
			
			db.all(sql, function(error, rows) {
				
				if (error == null) {
					var quotes = {};
					
					console.log(sprintf('Got %d quotes.', rows.length));
					rows.forEach(function(row) {
						quotes[row.symbol] = row;
					});
					
					resolve(quotes);
					
				}
				else
					reject(error);
			});
			
		});		
	};
	

	function runMinute(db, datetime) {
		
		return new Promise(function(resolve, reject) {
			
			// Set start time
			_this.time = new Date(datetime.getTime());
			
			getQuotes(db, datetime).then(function(quotes) {
				
				// Extend the data with minute data
				extend(_this.data, quotes);
	
				_this.algorithm.onData();
		
				resolve();			
				
			})
			
			.catch(function(error) {
				reject(error);
			});
		});
	}


	function runDay(db, date) {
		
		return new Promise(function(resolve, reject) {
			var startOfDay = new Date(date.getTime());
			
			startOfDay.setHours(9);
			startOfDay.setMinutes(30);
			startOfDay.setSeconds(0);
			startOfDay.setMilliseconds(0);

			var promises = [];
			
			// Set start time
			_this.time = new Date(startOfDay.getTime());
			
			// Reset quotes
			_this.data = {};

			for (var minute = 0; minute <= 390; minute++) {
				var datetime = new Date(startOfDay.getTime() + minute * 1000 * 60);
	
				promises.push(runMinute(db, datetime));
			}
	
			var promise = new Promise(function(resolve, reject){
				resolve();
			});
			
			promise.then(function() {
				_this.algorithm.onStartOfDay();			
				
				while (promises.length > 0) {
					promise.then(function(){
						promise = promises.shift(1);
					});
				}
						
				_this.algorithm.onEndOfDay();
				
				resolve();			
			})
			.catch(function(error) {
				reject(error);
			});
			
			
		});
	}
	
	this.run = function() {
		
		console.log(sprintf('Starting simulation...'));
		console.log('Initializing engine.');

		var db = new sqlite3.Database(_sqlFile);
		
		_this.config    = loadConfig();
		_this.time      = new Date();
		_this.data      = {};		
		_this.algorithm = loadAlgorithm();
				
		getStocks(db).then(function(stocks) {
			_this.stocks = stocks;
			_this.algorithm.onStartOfAlgorithm();		
	
			var date = new Date();
			date.setMonth(3);
			date.setDate(25);
			
			runDay(db, date).then(function(){
				_this.algorithm.onEndOfAlgorithm();		
				console.log('Done');
			})
			.catch(function(error){ 
				console.log(error);
			});
	
			
		});

		saveConfig(_this.config);
		
		console.log('Done.');
	}
	
	function init() {
		if (typeof args.algo != 'string') {
			throw new Error('No algorithm defined. Use --algo.');
		}

		
	}
	
	init();



};


