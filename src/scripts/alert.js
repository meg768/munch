var config  = require('./config.js');
var twilio  = require('twilio');

module.exports = function(error) {

	var message = "#ERROR#";

	function sendSMS(to, text) {

		text = text.substring(0, 160);

		var client = twilio(config.twilio.sid, config.twilio.token);

		var options  = {};
		options.to   = to;
		options.from = '+46769447443';
		options.body = text;

		client.sendSms(options, function(error, message) {

		    if (error)
				console.error('Cannot send SMS', error)
		});
	};

	if (error instanceof Error)
		message = error.message;

	return sendSMS(config.alerts.recipients, message);

}
