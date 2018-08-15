
var sprintf = require('yow/sprintf');
var methods = ['log', 'info', 'warn', 'error'];
var output  = {};

methods.forEach(name => {
	output[name] = console[name];
});



var prefixConsole = module.exports = function(options) {

	options = options || {};

	if (typeof options == 'function')
		options = {prefix:options};

	if (typeof options == 'string')
		options = {prefix:options};

	if (typeof options.prefix == 'undefined') {
		options.prefix = function() {
			var date = new Date();
			return sprintf('%04d-%02d-%02d %02d:%02d.%02d:', date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
		}
	}

	methods.forEach(name => {
		var method = output[name];

		console[name] = function() {
			Array.prototype.unshift.call(arguments, typeof options.prefix == 'function' ? options.prefix() : options.prefix);
		    return method.apply(console, arguments);
		};

	});

};


prefixConsole();
