
var Downloader = require('./downloader.js');


var App = function() {

	this.scheduleDownload = function() {
		var downloader = new Downloader(require('./symbols.js'));
		console.log('asdfasdf');
		downloader.scheduleDownload();
		
	};
}

function main() {
	var app = new App();
	
	app.scheduleDownload();
	
}


main();