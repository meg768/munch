var util    = require('util');
var methods = ['log', 'info', 'warn', 'error'];
var output  = {};

methods.forEach(name => {
	output[name] = console[name];
});

var pushoverConsole = module.exports = function(options) {

	options = options || {};

	var util    = require('util');
	var user    = options.user ? options.user : process.env.PUSHOVER_USER;
	var token   = options.token ? options.token : process.env.PUSHOVER_TOKEN;

	if (user == undefined || token == undefined) {
		output.warn('Environment variables PUSHOVER_USER and/or PUSHOVER_TOKEN not defined. Push notifications will not be able to be sent.');
	}
	else {

		function send(payload) {
			try {

				var PushoverNotifications = require('pushover-notifications');
				var push = new PushoverNotifications({user:user, token:token});

				// See https://pushover.net/api for payload parameters

				push.send(payload, function(error, result) {
					if (error) {
						output.error(error.stack);
					}
				});
			}
			catch(error) {
				output.error('Failed to send Pushover notification.', error.message);
			}
		};

		methods.forEach(name => {
			if (name != 'log') {
				var method = output[name];

				console[name] = function() {
					var text = util.format.apply(util.format, arguments);

					send({priority:name == 'info' ? 0 : 1, message:text});
				    return method.apply(console, [text]);
				};
			}
		});

	}

};

pushoverConsole();
