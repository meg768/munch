
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var schedule = require('node-schedule');

var Gopher  = require('../../lib/gopher.js');
var sprintf = require('../../lib/sprintf.js');
var utils   = require('../../lib/utils.js');
var extend  = require('../../lib/extend.js');

var config  = require('../scripts/config.js');
var stocks  = require('../scripts/stocks.js');

var Exporter = module.exports = function(args) {

	var _stockFolder  = config.folders.stocks;
	var _quoteFolder  = config.folders.quotes;
	var _outputFolder = args.output;

	if (typeof args.date != 'string') {
		throw new Error('Must specify --date');
		
	}	
	if (typeof args.output != 'string') {
		throw new Error('Must specify --output');
	}

	mkdir(_stockFolder);
	mkdir(_quoteFolder);
	mkdir(_outputFolder);
	
	function mkdir(path) {
		if (!fileExists(path)) {
			fs.mkdirSync(path);		
		}
		
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
	
	function readQuote(date, time, symbol) {
		var quote = {};
		quote.symbol = symbol;
		
		var fileName = sprintf('%s/%s/%s.json', _quoteFolder, date, symbol);
		
		if (!fileExists(fileName))
			return undefined;
			
		var json = JSON.parse(fs.readFileSync(fileName))[time];

		if (json == undefined)
			return undefined;
			
		var quote = {};
		quote.open   = json.open;
		quote.high   = json.high;
		quote.low    = json.low;
		quote.close  = json.close;
		quote.volume = json.volume;
		
		//console.log(JSON.stringify(quote));
		return quote;
	}
	
	function convertDateTime(date, time) {

		var quotes = undefined;
		
		for (var symbol in stocks) {
			var quote = readQuote(date, time, symbol);
			
			if (quote != undefined) {
				if (quotes == undefined)
					quotes = {};
					
				quotes[symbol] = quote;		
			}
			
		}

		if (quotes != undefined) {
			var path = sprintf('%s/%s', _outputFolder, date);
			var fileName = sprintf('%s/%02d.%02d.json', path, parseInt(time.split(':')[0]), parseInt(time.split(':')[1]));
			
			mkdir(path);
			
			fs.writeFileSync(fileName, JSON.stringify(quotes, null, '\t'));
		}

	}
	
	
	function convertDate(date) {

		var path = sprintf('%s/%s', _quoteFolder, date);
		
		if (fileExists(path)) {
			var startTime = new Date();
			
			startTime.setHours(9);
			startTime.setMinutes(30);
			startTime.setSeconds(0);
			startTime.setMilliseconds(0);
	
			for (var i = 0; i <= 390; i++) {
				var timeOfDay = new Date(startTime.getTime() + 1000 * i * 60);
				var time = sprintf('%02d:%02d', timeOfDay.getHours(), timeOfDay.getMinutes());
				
				console.log(sprintf('Exporting %s %s...', date, time));
				convertDateTime(date, time);
			}
			
		}
	}

	function convertQuotes(quotes) {
		console.log()
	}
	
	this.run = function() {
		
		console.log(sprintf('Exporting %s to \'%s\'...', args.date, _outputFolder));

		convertDate(args.date);
/*
		var dates = fs.readdirSync(_quoteFolder).filter(function(file) {
			return file.match('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
		});
		
		dates.forEach(function(date) {
			console.log(date);			
		});
		*/
		console.log('Done.');
	}


	
};


