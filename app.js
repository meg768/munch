var args    = require('minimist')(process.argv.slice(2));
var fs      = require('fs');
var sprintf = require('./lib/sprintf.js');
var App     = require('./src/app.js');


function run() {
	console.log('************************************************************************************');

	var configs = JSON.parse(fs.readFileSync('./config.json'));
	var config  = configs.config[args.config];

	if (config == undefined)
		config = configs.config['default'];

	if (config == undefined) {
		if (args.config == undefined)
			console.error(sprintf('No configuration available.'));
		else
			console.error(sprintf('Configuration \'%s\' not found.', args.config));
		
		process.exit(-1);
	}

	var app = module.exports = new App(args, config);	
	app.run();
}	


run();
