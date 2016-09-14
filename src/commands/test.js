
var fs       = require('fs');
var Promise  = require('bluebird');
var Path     = require('path');

var sprintf    = require('yow').sprintf;
var extend     = require('yow').extend;
var isString   = require('yow').isString;
var fileExists = require('yow').fileExists;
var mkdir      = require('yow').mkdir;
var mkpath     = require('yow').mkpath;
var isInteger  = require('yow').isInteger;
var isDate     = require('yow').isDate;




var Module = module.exports = function(args) {



	function stringify(o) {
		return JSON.stringify(o, null, '\t');
	}





	this.run = function() {

		var Progress = require('progress');

		var length  = args.count;
		var base    = 100;;//Math.log10(length);
		var bucket  = Math.floor((length / base));
		var total   = base;
		var count   = 0;

		var progressTemplate = sprintf('Downloading %d rows for table %s [:bar] :percent :etas', length, 'XXX');
		var progress = new Progress(progressTemplate, {total:total});
		var ticks = 0;

		for (var i = 0; i < length; i++) {
			if ((count++ % bucket) == 0) {
				progress.tick();
				ticks++;

			}

		}
		console.log('Ticks', ticks)
	};
}
