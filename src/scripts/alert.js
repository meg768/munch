var config  = require('./config.js');

module.exports = function(error) {

	var message = "#ERROR#";

	function sendSMS(to, text) {
		console.log('sedning error');
		var client = require('twilio')(config.twilio.sid, config.twilio.token);

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

	message = message.substring(0, 160);

	return sendSMS(config.alerts.recipients, message);

}
