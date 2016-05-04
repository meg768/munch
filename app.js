var Downloader = require('./src/downloader.js');
var args       = require('minimist')(process.argv.slice(2));
var fs         = require('fs');

var App = module.exports = function() {

	var _this = this;
	
	_this.config = JSON.parse(fs.readFileSync('./config.json'));
	
	_this.scheduleDownload = function(folder) {
		var downloader = new Downloader(require('./src/stocks.js').symbols, folder);
		downloader.scheduleDownload();
		
	};
	
	function init() {
		
	}
}

function main() {
	var app = new App();
	
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
			args.folder = app.config.quoteFolder;
		}

		if (args.folder == undefined) {
			console.error('The --folder option must be specified.');
		}
		else {
			app.scheduleDownload(args.folder);
			
		}
	}

}	


main();
