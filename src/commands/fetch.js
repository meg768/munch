

var fs          = require('fs');
var sprintf     = require('yow').sprintf;
var mkdir       = require('yow').mkdir;
var fileExists  = require('yow').fileExists;
var Promise     = require('bluebird');
var sqlite3     = require('sqlite3').verbose();

var Module = module.exports = function(args) {

	// rsync -avz pi@10.0.1.42:/home/pi/munch/data/downloads data
	console.log('OK!')

};
