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
	

		if (args.log) {
			var date = new Date();
			var logFile = sprintf('%s/%04d-%02d-%02d-%02d-%02d.log', config.logFolder, date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes());
			var access = fs.createWriteStream(logFile);
			process.stderr.write = process.stdout.write = access.write.bind(access);
			
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
