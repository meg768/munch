var fs         = require('fs');
var sprintf    = require('../lib/sprintf.js');
var express    = require('express');

var Server = module.exports = function() {

	// Remember me!
	var _this = this;

	
	_this.app = undefined;
	_this.server = undefined;
	
	function configureRoutes(app) {
		app.get('/inputs/:id', function(request, result) {
			result.status(200).send('OK');
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

	function init() {
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
		
		console.log('Listening to port 3000...');
		
		var server = app.listen(3000);


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
