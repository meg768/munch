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
		var data = engine.data;
		var symbol = config.symbol;


		// Build up the key (HH:MM)
		var dateKey = sprintf('%04d-%02d-%02d', engine.time.getFullYear(), engine.time.getMonth()+1, engine.time.getDate());
		var timeKey = sprintf('%02d:%02d', engine.time.getHours(), engine.time.getMinutes());


		if (data[symbol]) {
//			console.log(sprintf('%s %s %s %f', dateKey, timeKey, symbol, data[symbol].close));
		}
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
