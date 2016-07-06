var fs          = require('fs');
var sprintf     = require('yow').sprintf;
var mkdir       = require('yow').mkdir;
var isArray     = require('yow').isArray;
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
		//exec('ls', 'data');
		//exec('rsync', ['-avz', 'pi@10.0.1.42:/home/pi/munch/data/downloads/quotes/2016-07-05', 'q/downloads/quotes/2016-07-05']);
		exec('rsync', ['-avz', 'pi@10.0.1.42:/home/pi/munch/data/downloads', 'data']);
		// rsync -avz pi@10.0.1.42:/home/pi/munch/data/downloads data

	};

};
