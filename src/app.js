var Downloader = require('./downloader-II.js');
var fs         = require('fs');

var App = module.exports = function() {

	var _this = app = this;
	
	_this.config = JSON.parse(fs.readFileSync('./config.json'));
	

	_this.scheduleDownload = function(folder) {
		var downloader = new Downloader(require('./stocks.js').symbols, folder);
		downloader.scheduleDownload();
		
	};
	
	_this.run = function(args) {
	
		if (args.stderr == undefined) {
			if (app.config.logs && app.config.logs.stderr) {
				args.stderr = app.config.logs.stderr;			
			}		
		}
	
		if (args.stdout == undefined) {
			if (app.config.logs && app.config.logs.stdout) {
				args.stdout = app.config.logs.stdout;			
			}		
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
				args.folder = app.config.stockFolder;
			}
	
			if (args.folder == undefined) {
				console.error('The --folder option must be specified.');
			}
			else {
				app.scheduleDownload(args.folder);
				
			}
		}		
	};
};
