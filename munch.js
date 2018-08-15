#!/usr/bin/env node

require('dotenv').config();


require('./src/scripts/prefix-console');
require('./src/scripts/pushover-console');

var App = function() {


	this.fileName = __filename;

	function run() {
		try {
			var args = require('yargs');

			args.usage('Usage: $0 <command> [options]')

			args.command(require('./src/commands/download-quotes.js'));
			args.command(require('./src/commands/download-ticks.js'));
			args.command(require('./src/commands/backup.js'));
			args.command(require('./src/commands/server.js'));
			args.command(require('./src/commands/test.js'));

			args.help();
			args.wrap(null);

			args.check(function(argv) {
				return true;
			});

			args.demand(1);

			args.argv;

		}
		catch(error) {
			console.error(error);
			//process.exit(-1);
		}

	};

	run();
};

module.exports = new App();
