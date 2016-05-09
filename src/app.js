var fs         = require('fs');
var sprintf    = require('../lib/sprintf.js');
var config     = require('./scripts/config.js');

var App = module.exports = function(args) {

	function prefixLogs() {
		require('./scripts/console-prefix.js')(function() {
			var date = new Date();
			return sprintf('%04d-%02d-%02d %02d:%02d.%02d: ', date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
		});
		
	}

	function redirectLogs() {
		require('./scripts/console-redirect.js')(function() {
			var date = new Date();
			return sprintf('%s/%04d-%02d-%02d-%02d-%02d.log', config.folders.logs, date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes());
		});
		
	}	
	
	function getCommands() {
		
		var commands = {};
		
		fs.readdirSync('./src/commands').forEach(function(fileName) {
			var match = fileName.match('^(.*).js');
			
			if (match)
				commands[match[1]] = {fileName:sprintf('./commands/%s', fileName)};
		});
		
		return commands;
		
	}
	
	function runCommand(cmd) {
		
		var commands = getCommands();

		if (commands[cmd] == undefined)
			throw new Error(sprintf('Undefined command \'%s\'.', cmd));
			
		var Module = require(commands[cmd].fileName);
		var module = new Module(args);
		
		// Execute 'run' method if it has one
		if (typeof module.run == 'function')
			module.run();
	}
	
	this.run = function() {

		try {
			if (!args.noprefix) {
				prefixLogs();
			}
			
			if (args.log) {
				redirectLogs();
			}

			if (typeof args.run == 'string') {
				runCommand(args.run);
			}

			if (args.run == undefined) {
				console.log(sprintf('No --run command specified. Choose one of [%s].', Object.keys(getCommands()).join(', ')));
			}


		}
		catch (error) {
			console.error((error && error.stack) ? error.stack : error);
		};
	};
};
