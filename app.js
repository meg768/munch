var Downloader = require('./src/downloader.js');
var args       = require('minimist')(process.argv.slice(2));
var fs         = require('fs');
var App        = require('./src/app.js');


function run() {
	var app = new App();
	app.run(args);

}	


run();
