#!/usr/bin/env node



var Command = new function() {


	function defineArgs(args) {
		args.option('text', {alias: 't', describe:'Schedule job at specified cron date/time format', default:'Hello'});

		args.help();
		args.wrap(null);

		args.check(function(argv) {
			return true;
		});

	}



	function run(args) {

		console.warn('Upps!');
	};


	module.exports.command  = ['test [options]', 't [options]'];
	module.exports.describe = 'Testing module';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;

};
