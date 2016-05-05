var Downloader = require('./downloader-II.js');
var fs         = require('fs');
var sprintf    = require('../lib/sprintf.js');

var App = module.exports = function(args, config) {

	// Remember me!
	var _this = this;
	
	// Remember my configs
	_this.config = config;
	

	_this.scheduleDownload = function(folder) {
		var downloader = new Downloader(require('./stocks.js').symbols, folder);
		downloader.scheduleDownload();
		
	};
	
	_this.run = function() {
	
		if (args.stderr == undefined) {
			if (_this.config.logs && _this.config.logs.stderr) {
				args.stderr = app.config.logs.stderr;			
			}		
		}
	
		if (args.stdout == undefined) {
			if (_this.config.logs && _this.config.logs.stdout) {
				args.stdout = _this.config.logs.stdout;			
			}		
		}
	

		// Redirect stdout?
		if (args.log) {
			console.log(config);
			var date = new Date();
			var logFile = sprintf('%s/%04d-%02d-%02d-%02d-%02d.log', config.logFolder, date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes());
			var access = fs.createWriteStream(logFile);
			process.stderr.write = process.stdout.write = access.write.bind(access);
			
		}
	
		
		// Redirect stdout?
		if (args.stdout) {
			var access = fs.createWriteStream(args.stdout);
			process.stdout.write = access.write.bind(access);
			
		}
	
		// Redirect stderr?
		if (args.stderr) {
			var access = fs.createWriteStream(args.stderr);
			process.stderr.write = access.write.bind(access);
		
			// Make sure we catch uncaught exceptions
			process.on('uncaughtException', function(err) {
				console.error((err && err.stack) ? err.stack : err);
			});
			
	
		}
	
		if (args.download) {
	
			if (args.folder == undefined) {
				args.folder = _this.config.stockFolder;
			}
	
			if (args.folder == undefined) {
				console.error('The --folder option must be specified.');
			}
			else {
				_this.scheduleDownload(args.folder);
				
			}
		}		
	};
};
