var args    = require('minimist')(process.argv.slice(2));
var fs      = require('fs');
var sprintf = require('../lib/sprintf.js');
var extend  = require('../lib/extend.js');

(function () {

	var configs = JSON.parse(fs.readFileSync('./config.json')).configs;
	var config  = {};
	
	if (configs == undefined) {
		console.error('No \'configs\' specified.');
		process.exit(-1);
	}
	
	extend(config, configs['default']);
	
	if (args.config != undefined) {
		if (configs[args.config] == undefined) {
			console.error(sprintf('Configuration \'%s\' not defined.', args.config));
			process.exit(-1);
		}
		extend(config, configs[args.config]);
	}
	
	module.exports = config;	

}());

