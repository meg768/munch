var fs         = require('fs');
var sprintf    = require('yow').sprintf;

var Workday = function(engine, config) {
	
	var _state = 'idle';
	
	
};


var Module = module.exports = function(engine) {

	/*
		engine.config  - settings from the configuration file
		engine.time    - specifies the current time
		engine.data    - contains quotes for all symbols
		engine.stocks  - contains information about each company
		engine.symbols - array containing all symbols
	*/
	
	var workday = null;
	var config  = engine.config;
	
	this.onData = function() {
		var quotes = engine.data;
		var symbol = config.symbol;
		
		//if (quotes[symbol])
		//	console.log(symbol, quotes[symbol].close);
	}

	this.onStartOfAlgorithm = function() {
		console.log('Started algorithm', engine.time);
		
		workday = new Workday(engine, config);
	}

	this.onEndOfAlgorithm = function() {
		console.log('Ended algorithm', engine.time);		
		
	}

	this.onStartOfDay = function() {
		console.log('Start of day', engine.time);		
		
	}
	
	this.onEndOfDay = function() {
		console.log('End of day', engine.time);		
	}


};
