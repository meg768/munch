

var sprintf = require('yow/sprintf');
var util = require('util');
var methods = ['log', 'info', 'warn', 'error'];
var output = {};

methods.forEach(function(name) {
	output[name] = console[name];
});

var formatConsole = module.exports = function(options) {

	options = options || {};


	methods.forEach(function(name) {
		var method = output[name];


		console[name] = function() {
            var date = new Date();
            var prefix = sprintf('%04d-%02d-%02d: ', date.getFullYear(), date.getMonth() + 1, date.getDate());
            var args = [prefix].concat(Array.prototype.slice.call(arguments)));

			var text = sprintf.apply(sprintf, arguments);

		    return method.apply(console, [text]);
		};
	});

};

formatConsole();
