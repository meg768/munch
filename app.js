
var args         = require('minimist')(process.argv.slice(2));
var sprintf      = require('yow').sprintf;
var isString     = require('yow').isString;
var prefixLogs   = require('yow').prefixLogs;
var redirectLogs = require('yow').redirectLogs;
var fs           = require('fs');
var config       = require('./src/scripts/config.js');

var App = function() {

	var mkdir = require('yow').mkdir;
	var fileExists = require('yow').fileExists;

	function getCommands() {

		var commands = {};

		fs.readdirSync('./src/commands').forEach(function(fileName) {
			var match = fileName.match('^(.*).js');

			if (match)
				commands[match[1]] = {fileName:sprintf('./src/commands/%s', fileName)};
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


var app = new App();
app.run();
