#!/usr/bin/env node

var sprintf    = require('yow/sprintf');
var isString   = require('yow/is').isString;
var mkpath     = require('yow/fs').mkpath;
var prefixLogs = require('yow/logs').prefix;

var Module = new function() {

	var _argv = undefined;

	function defineArgs(args) {

		args.usage('Usage: $0 [options]');
		args.option('help',     {alias:'h', describe:'Displays this information'});
		args.option('database', {alias:'d', describe:'Specifies mysql database', default:'lights'});
		args.option('bucket',   {alias:'b', describe:'Upload backup to Google bucket', default:'gs://mysql.app-o.se/backups'});
		args.option('schedule', {alias:'s', describe:'Schedule backup, crontab syntax'});
		args.option('password', {alias:'p', describe:'Password for mysql', required:true});
		args.option('verbose',  {alias:'V', describe:'Display commands executed', default:true});
		args.option('user',     {alias:'u', describe:'Mysql user name', default:'root'});
		args.option('dry-run',  {alias:'n', describe:'Don\'t actually run any commands', default:false});

		args.wrap(null);

		args.check(function(argv) {

			return true;
		});

		return args.argv;
	}

	function exec(cmd) {

		return new Promise(function(resolve, reject) {
			var cp = require('child_process');

			if (_argv.verbose)
				console.log('$', cmd);

			if (_argv.dryRun) {
				resolve();
			}
			else {
				cp.exec(cmd, function(error, stdout, stderr) {

					if (stdout)
						console.log(stdout);

					if (!error)
						resolve();
					else
						reject(error);

				});

			}

		});

	};

	function runOnce() {

		var now = new Date();


		var database   = _argv.database;
		var password   = _argv.password;
		var bucket     = _argv.bucket;
		var user       = _argv.user;


		var datestamp  = sprintf('%04d-%02d-%02d-%02d-%02d', now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());

		var tmpPath    = sprintf('%s/%s', __dirname, 'backups');
		var backupName = sprintf('%s-%s.sql.gz', database, datestamp);
		var backupFile = sprintf('%s/%s', tmpPath, backupName);

		mkpath(tmpPath);

		var commands = [];
		commands.push(sprintf('rm -f %s/*.gz', tmpPath));
		commands.push(sprintf('mysqldump --triggers --routines --quick --user %s -p%s %s | gzip > %s', user, password, database, backupFile));
		commands.push(sprintf('gsutil cp %s %s/%s', backupFile, bucket, backupName));

		var promise = Promise.resolve();

		console.log('Running backup...');

		commands.forEach(function(cmd) {
			promise = promise.then(function() {
				return exec(cmd);
			});
		});

		promise.then(function() {
			console.log('Finished.');
		})
		.catch(function(error) {
			console.error(error.message);

		});

	}

	function schedule() {

		var Schedule = require('node-schedule');
		var running = false;

		console.log(sprintf('Scheduling backup to run at "%s"...', _argv.schedule));

		Schedule.scheduleJob(_argv.schedule, function() {

			if (running) {
				console.log('Upps! Running already!!');
			}
			else {
				running = true;
				runOnce();
				running = false;
			}
		});

	}

	function run(argv) {


		try {
			_argv = argv;

			prefixLogs();

			if (isString(argv.schedule))
				schedule();
			else
				runOnce();

		}
		catch (error) {
			console.error(error.stack);
		}

	}


	module.exports.command  = 'backup [options]';
	module.exports.describe = 'Backup MySQL database';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;

};
