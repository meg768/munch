var args = require('minimist')(process.argv.slice(2));
var fs   = require('fs');
var App  = require('./src/app.js');


function run() {
	var config = JSON.parse(fs.readFileSync('./config.json'));
	var app = new App(args, config);	
	
	app.run();
}	


run();
