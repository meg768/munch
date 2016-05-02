var Downloader = require('./src/downloader.js');
var args       = require('minimist')(process.argv.slice(2));


var App = function() {

	this.scheduleDownload = function() {
		var downloader = new Downloader(require('./src/stocks.js').symbols);
		downloader.scheduleDownload();
		
	};
}


function main() {
	var app = new App();
	
	if (args.download) {
		app.scheduleDownload();
	}
	
}


main();