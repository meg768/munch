var config  = require('config.js');

module.exports = class AlertError extends Error {

	constructor(message) {
		console.log('Upps error');
		super(message);
	}

	sendSMS(to, text) {
		return new Promise(function(resolve, reject) {
			var client = require('twilio')(config.twilio.sid, config.twilio.token);

			var options  = {};
			options.to   = to;
			options.from = '+46769447443';
			options.body = text;

			client.sendSms(options, function(error, message) {

			    if (error)
					reject(error);
				else
					resolve();
			});

		});
	};

}
