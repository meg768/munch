
var fs         = require('fs');
var Promise    = require('bluebird');
var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var fileExists = require('yow').fileExists;
var config     = require('../scripts/config.js');
var sqlite3    = require('sqlite3');


var Simulation = module.exports = function(args) {

	var _this = this;
	var _sqlFile = './data/db/quotes.db';
	
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
			
			db.all(sql, function(error, rows) {
				
				if (error == null) {
					var quotes = {};
					
					//console.log(sprintf('Got %d quotes.', rows.length));
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

	function getDates(db) {
		
		return new Promise(function(resolve, reject) {
			
			var sql = sprintf('SELECT DISTINCT date FROM quotes ORDER BY date');
			
			console.log('Fetching dates...');
			
			db.all(sql, function(error, rows) {
				
				if (error == null) {
					var dates = [];
					
					rows.forEach(function(row) {
						var parts = row.date.split('-');
						
						var date = new Date();
						date.setFullYear(parseInt(parts[0]));
						date.setMonth(parseInt(parts[1]) - 1);
						date.setDate(parseInt(parts[2]));
						date.setHours(0);
						date.setMinutes(0);
						date.setSeconds(0);
						date.setMilliseconds(0);
						
						dates.push(date);
						
					});			
							
					resolve(dates);
					
				}
				else
					reject(error);
			});
			
		});		
	};	

	function runMinute(db, datetime) {
		
		return new Promise(function(resolve, reject) {
			
			getQuotes(db, datetime).then(function(quotes) {
				

				// Set start time
				_this.time = new Date(datetime.getTime());
				
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

			var minutes = [];
			
			// Reset quotes
			_this.data = {};

			for (var minute = 0; minute <= 390; minute++) {
				var datetime = new Date(startOfDay.getTime() + minute * 1000 * 60);
	
				minutes.push(datetime);
			}
			
			// Set start time
			_this.time = new Date(startOfDay.getTime());
			
			_this.algorithm.onStartOfDay();			
			
			return Promise.each(minutes, function(datetime) {
				return runMinute(db, datetime);	
			})
			.then(function() {
				_this.algorithm.onEndOfDay();
				resolve();
			})
			
			.catch(function(error) {
				reject(error);
			});
		});
	}
	
	function runSimulation() {
		
		return new Promise(function(resolve, reject) {
			console.log(sprintf('Starting simulation...'));
	
			var db = new sqlite3.Database(_sqlFile);
			
			getStocks(db).then(function(stocks) {
				getDates(db).then(function(dates) {
					_this.stocks = stocks;
					
					_this.algorithm.onStartOfAlgorithm();		
	
					Promise.each(dates, function(date) {
						return runDay(db, date);
						
					})
					
					.then(function() {
						_this.algorithm.onEndOfAlgorithm();	
						resolve();
						
					})
					.catch(function(error){ 
						console.log(sprintf('Simulation failed. %s', error));
					});
					
				});
		
				
			});
	
			
		});
		
	}
	
	
	this.run = function() {

		_this.config    = loadConfig();
		_this.time      = new Date();
		_this.data      = {};		
		_this.algorithm = loadAlgorithm();
				
		
		runSimulation().then(function() {
			saveConfig(_this.config);
			console.log('Done.');			
		})
		
		.catch(function(error){ 
			console.log(sprintf('Simulation failed. %s', error));
		});

	}
	
	function init() {
		if (typeof args.algo != 'string') {
			throw new Error('No algorithm defined. Use --algo.');
		}

		
	}
	
	init();



};


