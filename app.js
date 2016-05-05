var args    = require('minimist')(process.argv.slice(2));
var fs      = require('fs');
var sprintf = require('./lib/sprintf.js');
var App     = require('./src/app.js');


function run() {
	var configs = JSON.parse(fs.readFileSync('./config.json'));
	

	if (args.config == undefined) {
		console.error('Must specify configuration using --config.');
		process.exit(-1);
	}

	var config = configs.config[args.config];

	if (config == undefined)
		config = configs.config['default'];
	
	if (config == undefined) {
		console.error(sprintf('Configuration \'%s\' not found.', args.config));
		process.exit(-1);
	}
		
	var app = new App(args, config);	
	app.run();
}	


run();
