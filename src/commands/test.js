#!/usr/bin/env node

var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');
var Schedule = require('node-schedule');

var sprintf    = require('yow/sprintf');
var extend     = require('yow/extend');
var isString   = require('yow/is').isString;
var fileExists = require('yow/fs').fileExists;
var mkdir      = require('yow/fs').mkdir;
var mkpath     = require('yow/fs').mkpath;
var isInteger  = require('yow/is').isInteger;
var prefixLogs = require('yow/logs').prefix;

var Gopher  = require('rest-request');
var MySQL   = require('../scripts/mysql.js');

var Command = new function() {


	function defineArgs(args) {
		args.option('schedule', {alias: 'x', describe:'Schedule job at specified cron date/time format'});

/*
		args.option('count',    {alias: 'c', describe:'Number of quotes to fetch per batch', default:10});
		args.option('days',     {alias: 'd', describe:'Specifies number of days back in time to fetch', default: 5});
		args.option('pause',    {alias: 'p', describe:'Number of seconds to pause before fetching next batch', default:15});
*/

		args.help();

		args.wrap(null);

		args.check(function(argv) {
			return true;
		});

	}





	function runOnce() {

		return new Promise(function(resolve, reject) {
			console.log('Running!');
			resolve();
		});


	}

	function schedule(cron, fn) {

		var busy    = false;

		console.log(sprintf('Scheduling to start work at cron-time "%s"...', cron));

		var job = Schedule.scheduleJob(cron, function() {
			if (busy) {
				console.log('Busy. Try again later.');
			}
			else {
				busy = true;

				fn().then(function() {
					console.log('Finished for today.');
				})
				.catch(function(error) {
					console.log(error);
				})
				.finally(function() {
					busy = false;
				});
			}
		});


		if (job == null) {
			throw new Error('Invalid cron time.');
		}

	};

	function run(args) {

		try {
			prefixLogs();

			if (isString(args.schedule)) {
				schedule(args.schedule, runOnce);
			}
			else {
				runOnce().then(function() {
					console.log('Finished for today.');
				})
				.catch(function(error) {
					console.log(error);
				})
				.finally(function() {
				});

			}


		}
		catch(error) {
			console.log(error);
		}

	};


	module.exports.command  = ['test [options]', 't [options]'];
	module.exports.describe = 'Testing module';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;

};




//2017-01-12	118.895	119.3	118.21	119.25
