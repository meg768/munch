
var fs       = require('fs');
var sprintf  = require('yow').sprintf;

var config  = require('../scripts/config.js');
var stocks  = require('../scripts/stocks.js');


/*

	args.date - specifies the stock dates to transform (or specify 'all')
	args.update - only update, if the transformation has been done, don't do it again	
	
*/

var Transformer = module.exports = function(args) {

	var _downloadFolder  = config.transform.downloadFolder;
	var _quotesFolder    = config.transform.quotesFolder;


	if (typeof args.date != 'string') {
		throw new Error('Must specify --date');
		
	}	

	if (!fileExists(_downloadFolder)) {
		throw new Error('The download folder does not exist');
	}

	mkdir(_quotesFolder);
	
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
		
		var fileName = sprintf('%s/%s/%s.json', _downloadFolder, date, symbol);
		
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

		var quotes   = undefined;
		var path     = sprintf('%s/%s', _quotesFolder, date);
		var fileName = sprintf('%s/%02d.%02d.json', path, parseInt(time.split(':')[0]), parseInt(time.split(':')[1]));
		
		if (args.update) {
			if (fileExists(fileName)) {
				console.log(sprintf('Already transformed %s %s.', date, time));
				return;				
			}
		}
		
		for (var symbol in stocks) {
			var quote = readQuote(date, time, symbol);
			
			if (quote != undefined) {
				if (quotes == undefined)
					quotes = {};
					
				quotes[symbol] = quote;		
			}
			
		}

		if (quotes != undefined) {
			mkdir(path);			

			fs.writeFileSync(fileName, JSON.stringify(quotes, null, '\t'));
			console.log(sprintf('Transformed %s %s into %s.', date, time, fileName));
		}

	}
	
	
	function convertDate(date) {

		var path = sprintf('%s/%s', _downloadFolder, date);
		
		if (fileExists(path)) {
			var startTime = new Date();
			
			startTime.setHours(9);
			startTime.setMinutes(30);
			startTime.setSeconds(0);
			startTime.setMilliseconds(0);
	
			for (var i = 0; i <= 390; i++) {
				var timeOfDay = new Date(startTime.getTime() + 1000 * i * 60);
				var time = sprintf('%02d:%02d', timeOfDay.getHours(), timeOfDay.getMinutes());
				
				convertDateTime(date, time);
			}
			
		}
	}

	
	this.run = function() {
		
		console.log(sprintf('Transforming %s to \'%s\'...', args.date, _quotesFolder));

		var dates = [args.date];
		
		if (args.date == 'all') {
			dates = fs.readdirSync(_downloadFolder).filter(function(file) {
				return file.match('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
			});
		}

		dates.forEach(function(date) {
			convertDate(date);
		});

		console.log('Done.');
	}


	
};


