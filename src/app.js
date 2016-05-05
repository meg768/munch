var fs         = require('fs');
var args       = require('minimist')(process.argv.slice(2));

var Downloader = require('./downloader.js');
var Server     = require('./server.js');

var sprintf    = require('../lib/sprintf.js');
var config     = require('./config.js');

var App = module.exports = function() {

	// Remember me!
	var _this = this;
	var _server = undefined;
	
	function scheduleDownload() {
		var downloader = new Downloader(require('./stocks.js').symbols);
		downloader.scheduleDownload();
		
	};

	
	_this.run = function() {
	

		if (args.server) {
			_server = new Server(config);
		}
		
		if (args.test) {
		}

		if (args.log) {
			var date = new Date();
			var logFile = sprintf('%s/%04d-%02d-%02d-%02d-%02d.log', config.folders.logs, date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes());
			var access = fs.createWriteStream(logFile);

			process.stderr.write = process.stdout.write = access.write.bind(access);
			
			process.on('uncaughtException', function(err) {
				console.error((err && err.stack) ? err.stack : err);
			});			
			
		}
	
	
		if (args.download) {
	
			scheduleDownload();
		}		
	};
};
