var fs          = require('fs');
var sprintf     = require('yow').sprintf;
var mkdir       = require('yow').mkdir;
var isArray     = require('yow').isArray;
var isString    = require('yow').isString;
var fileExists  = require('yow').fileExists;
var Promise     = require('bluebird');

var Module = module.exports = function(args) {

	function exec(cmd, args, options) {

		if (options == undefined)
			options = {};

		if (!isArray(args)) {
			args = [args];
		}

		function YES() {
			console.log('Done');

		};

		function NO() {
			console.log('Nope');

		};

		try {
			var spawn = require('child_process').spawn;

			//var cmd     = 'rsync';
			//var args    = ['-avz', 'pi@10.0.1.42:/home/pi/munch/data/downloads', 'data'];
			//var options = {};
			var process = spawn(cmd, args, options);

			process.stderr.on('data', function (data) {
				console.log('ERROR#', data.toString());
			});

			process.stdout.on('data', function (data) {
				console.log(data.toString());
			});

			if (process == null) {
				NO();
			}
			else {
				process.on('error', function() {
					NO();
				});

				process.on('close', function() {
					YES();
				});
			}

			return _process = process;
		}
		catch (error) {
			console.log(error);
			NO(error);
		}

	}

	this.run = function() {
		var user       = 'pi';
		var server     = '10.0.1.2';
		var path       = '/home/pi/munch/data/downloads'
		var remotePath = '';
		var localPath  = ''

		if (isString(args.date)) {

			if (args.date.match('^([0-9]{4}-[0-9]{2}-[0-9]{2})$')) {
				remotePath = sprintf('%s@%s:%s/quotes/%s', user, server, path, args.date)
				localPath  = sprintf('data/downloads/quotes');
			}
			else {
				console.error('Invalid date format.');
				process.exit(-1);
			}
			//exec('rsync', ['-avz', 'pi@10.0.1.42:/home/pi/munch/data/downloads/quotes/2016-07-05', 'q/downloads/quotes/2016-07-05']);

		}
		else {
			remotePath = sprintf('%s@%s:%s', user, server, path);
			localPath  = sprintf('data');

		}
		console.log(remotePath, '=>', localPath);
		//exec('ls', 'data');
		//exec('rsync', ['-avz', 'pi@10.0.1.42:/home/pi/munch/data/downloads/quotes/2016-07-05', 'q/downloads/quotes/2016-07-05']);
		//exec('rsync', ['-avz', 'pi@10.0.1.2:/home/pi/munch/data/downloads', 'data']);
		// rsync -avz pi@10.0.1.42:/home/pi/munch/data/downloads data
		exec('rsync', ['-avz', remotePath, localPath]);

	};

};
