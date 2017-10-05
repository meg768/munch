/*
	See https://pushover.net/api for payload parameters
*/

var Pushover = function() {

	var _this  = this;
	var _user  = process.env.PUSHOVER_USER;
	var _token = process.env.PUSHOVER_TOKEN;

	if (_user == undefined || _token == undefined) {
		console.log('Environment variables PUSHOVER_USER and/or PUSHOVER_TOKEN not defined. Push notifications will not be able to be sent.');
	}

	_this.send = function(payload) {
		try {
			console.log('*', payload.message);

			if (_user != undefined && _token != undefined) {
				var Pushover = require('pushover-notifications');
				var push = new Pushover({user:_user, token:_token});

				push.send(payload, function(error, result) {
					if (error) {
						console.error(error);
					}
				});
			}
		}
		catch(error) {
			console.error(error);
		}
	};

	_this.log = function(message) {
		return _this.send({priority:0, message:message});
	};

	_this.notify = function(message) {
		return _this.send({priority:0, message:message});
	};

	_this.error = function(error) {
		return _this.send({priority:1, message:error.stack});
	};

	_this.alert = function(error) {
		return _this.send({priority:1, message:error.message});
	};

};

module.exports = new Pushover();
