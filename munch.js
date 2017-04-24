#!/usr/bin/env node

var App = function() {


	this.fileName = __filename;


	function run() {
		try {
			var args = require('yargs');

			args.usage('Usage: $0 <command> [options]')

			args.command(require('./src/commands/download-quotes.js'));
			args.command(require('./src/commands/download-ticks.js'));
			args.command(require('./src/commands/backup.js'));

			args.help();
			args.wrap(null);

			args.check(function(argv) {
				return true;
			});

			args.demand(1);

			args.argv;

		}
		catch(error) {
			console.log(error.stack);
			process.exit(-1);
		}

	};

	run();
};

module.exports = new App();