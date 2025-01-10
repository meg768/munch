#!/usr/bin/env node

var sprintf    = require('yow/sprintf');
var isString   = require('yow/isString');
var mkpath     = require('yow/mkpath');

class Command {

	constructor() {
	}

	defineArgs(args) {

		args.usage('Usage: $0 [options]');
		args.option('help',     {alias:'h', describe:'Displays this information'});
		args.option('database', {describe:'Specifies mysql database', default:process.env.MYSQL_DATABASE});
		args.option('host',     {describe:'Specifies mysql host', default:process.env.MYSQL_HOST});
		args.option('schedule', {describe:'Schedule backup, crontab syntax'});
		args.option('password', {describe:'Password for MySQL', default:process.env.MYSQL_PASSWORD});
		args.option('port',     {describe:'Port for MySQL', default:process.env.MYSQL_PORT});
		args.option('verbose',  {describe:'Display commands executed', default:true});
		args.option('user',     {describe:'MySQL user name', default:process.env.MYSQL_USER});
		args.option('dry',      {describe:'Don\'t actually run any commands', default:false});
		args.option('debug',    {describe:'Show debug messages', default:true});

		args.wrap(null);

		args.check(function(argv) {

			return true;
		});

		return args.argv;
	}

	async exec(cmd) {

		return new Promise((resolve, reject) => {
			var cp = require('child_process');

			if (this.argv.verbose)
				this.log('$', cmd);

			if (this.argv.dry) {
				resolve();
			}
			else {
				cp.exec(cmd, (error, stdout, stderr) =>	{

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


	async backup() {
		var Path = require('path');
		var now = new Date();

		var database   = this.argv.database;
		var password   = this.argv.password;
		var user       = this.argv.user;
		var host       = this.argv.host;
		var port       = this.argv.port;

		var datestamp  = sprintf('%04d-%02d-%02d-%02d-%02d', now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());

		var tmpPath    = Path.join(__dirname, 'backups'); 
		//var backupName = `${database}-${datestamp}.sql.gz`;
		var backupName = `${database}-${datestamp}.sql`;
		var backupFile = Path.join(tmpPath, backupName);


		mkpath(tmpPath);

		var commands = [];
		//commands.push(`mysqldump --triggers --routines --host ${host} --user ${user} -p${password} ${database} | gzip > ${backupFile}`);
		commands.push(`mysqldump --column-statistics=0 --triggers --routines --host ${host} --user ${user} -P${port} -p${password} ${database} > ${backupFile}`);

		console.info('Running backup...');

		commands.forEach(async (cmd) => {
			await this.exec(cmd);
		});

		this.log('Backup finished.');


	}


	async schedule() {

		var Schedule = require('node-schedule');
		var running = false;

		console.info(sprintf('Scheduling backup to run at "%s"...', this.argv.schedule));

		Schedule.scheduleJob(this.argv.schedule, async () => {

			if (running) {
				console.log('Upps! Running already!!');
			}
			else {
				running = true;
				await this.backup();
				running = false;
			}
		});
	}


	async run(argv) {

		try {
			this.argv = argv;
			this.log = console.log;
			this.debug = this.argv.debug ? console.log : () => {};

			if (isString(this.argv.schedule))
				await this.schedule();
			else
				await this.backup();

		}
		catch (error) {
			console.error(error.stack);
		}

	}

}



var cmd = new Command();
module.exports.command  = 'backup [options]';
module.exports.describe = 'Backup MySQL database';
module.exports.builder  = cmd.defineArgs.bind(cmd);
module.exports.handler  = cmd.run.bind(cmd);




/*

var Module = new function() {

	var _argv = undefined;

	function defineArgs(args) {

		args.usage('Usage: $0 [options]');
		args.option('help',     {alias:'h', describe:'Displays this information'});
		args.option('database', {alias:'d', describe:'Specifies mysql database', default:process.env.MYSQL_DATABASE});
		args.option('bucket',   {alias:'b', describe:'Upload backup to Google bucket', default:'gs://mysql.app-o.se/backups'});
		args.option('schedule', {alias:'s', describe:'Schedule backup, crontab syntax'});
		args.option('password', {alias:'p', describe:'Password for MySQL', default:process.env.MYSQL_PASSWORD});
		args.option('port',     {alias:'P', describe:'Port for MySQL', default:process.env.MYSQL_PORT});
		args.option('verbose',  {alias:'V', describe:'Display commands executed', default:true});
		args.option('user',     {alias:'u', describe:'MySQL user name', default:process.env.MYSQL_USER});
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

		try {
			var now = new Date();


			var database   = _argv.database;
			var password   = _argv.password;
			var user       = _argv.user;


			var datestamp  = sprintf('%04d-%02d-%02d-%02d-%02d', now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());

			var tmpPath    = sprintf('%s/%s', __dirname, 'backups');
			//var backupName = sprintf('%s-%s.sql.gz', database, datestamp);
			var backupName = sprintf('%s-%s.sql', database, datestamp);
			var backupFile = sprintf('%s/%s', tmpPath, backupName);


			mkpath(tmpPath);

			var commands = [];
			commands.push(sprintf('rm -f %s/*.gz', tmpPath));
			//commands.push(sprintf('mysqldump --triggers --routines --user %s -p%s %s | gzip > %s', user, password, database, backupFile));
			commands.push(sprintf('mysqldump --triggers --routines --user %s -p%s %s  > %s', user, password, database, backupFile));

			var promise = Promise.resolve();

			console.info('Running backup...');

			commands.forEach(function(cmd) {
				promise = promise.then(function() {
					return exec(cmd);
				});
			});

			promise.then(function() {
				console.info('Backup finished.');
			})
			.catch(function(error) {
				console.error(error);

			});

		}
		catch(error) {
			console.error(error);
		}

	}

	function schedule() {

		var Schedule = require('node-schedule');
		var running = false;

		console.info(sprintf('Scheduling backup to run at "%s"...', _argv.schedule));

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

*/