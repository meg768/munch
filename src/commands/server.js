/*
	
	To kill all node instances run
	$ killall -9 node
	
*/

var fs         = require('fs');
var express    = require('express');
var sprintf    = require('yow').sprintf;
var config     = require('../scripts/config.js');

var Server = module.exports = function(args) {

	if (config.server == undefined)
		throw new Error('No configuration for server!');
		
	// Remember me!
	var _this = this;
	var _stocksFolder = config.server.stocksFolder;
	var _quotesFolder = config.server.quotesFolder;

	var _stocks = {};
	var _symbols = [];
	
	_this.app = undefined;
	_this.server = undefined;
	
	function getSymbols() {

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

	function getStocks(symbols) {
	
		var stocks = {};
		
		symbols.forEach(function(symbol) {
			var fileName = sprintf('%s/%s.json', _stocksFolder, symbol);		
			var stock    = JSON.parse(fs.readFileSync(fileName));
			
			stocks[symbol] = stock;	
		});	
		
		return stocks;
		
	};	
	
	
	function init() {
		if (config.server.port == undefined) {
			config.server.port = 3000;
			console.log(sprintf('No port specified. Assuming port %d', config.server.port));
		}

		_symbols = getSymbols();	
		_stocks  = getStocks(_symbols);
	}
	
	function configureRoutes(app) {


		app.get('/symbols', function(request, result) {
			result.status(200).send(JSON.stringify(_symbols));
		}); 
		
		app.get('/stock/:id', function(request, result) {
			
			var symbol = request.params.id;
			var stock  = _stocks[symbol];
			
			if (stock == undefined)
				stock = {};
				
			result.status(200).send(JSON.stringify(stock));
		}); 

		app.get('/quotes/:date/:time', function(request, result) {
			
			var date   = request.params.date;
			var time   = request.params.time;
			var path   = sprintf('%s/%s/%s.json', _quotesFolder, date, time);

			var quote = {};
			
			try {
				quote = JSON.parse(fs.readFileSync(path));
				
			}
			catch (error) {
				
			}

			result.status(200).send(JSON.stringify(quote));
		}); 
		
	}

	function shutDown() {
		
		var server = _this.server;
		
		console.log("Received kill signal, shutting down gracefully.");
		
		server.close(function() {
			console.log("Closed out remaining connections.");
			process.exit();
		});
	
		setTimeout(function() {
			console.error("Could not close connections in time, forcefully shutting down");
			process.exit()
		}, 10*1000);
	}

	_this.run = function() {

		var app = express();
		
		configureRoutes(app);
		
		// Express route for any other unrecognised incoming requests
		app.get('*', function (request, result) {
			result.status(404).send('Unrecognised API call');
		});
		
		// Express route to handle errors
		app.use(function (error, request, result, next) {
			if (request.xhr) {
				result.status(500).send('Oops, Something went wrong!');
			}
			else {
				next(error);
			}
		}); 
		
		console.log(sprintf('Listening to port %s...', '' + config.server.port + ''));
		var server = app.listen(config.server.port);

		process.on('uncaughtException', shutDown);
		
		// listen for TERM signal .e.g. kill 
		process.on ('SIGTERM', shutDown);
		
		// listen for INT signal e.g. Ctrl-C
		process.on ('SIGINT', shutDown); 

		
		_this.app = app;
		_this.server = server;
	}

	init();
};
