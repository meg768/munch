
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
		console.log('hej');
		var ProgressBar = require('progress');

		var bar = new ProgressBar('[:bar] :percent :eta', { total: 80 });
		var timer = setInterval(function () {
		  bar.tick();
		  if (bar.complete) {
		    console.log('\ncomplete\n');
		    clearInterval(timer);
		  }
		}, 100);
	};
}
