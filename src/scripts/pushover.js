
var isString   = require('yow/is').isString;


var Pushover = function() {

	var _this = this;

	_this.send = function(message) {
		/*
			message.message  = 'Hej';
			message.title    =  "Well";
			message.sound    =  'magic';
			message.device   =  'iphone';
			message.priority = 0;
		*/

		if (isString(message)) {
			message = {message:message};
		}

		var Pushover = require('pushover-notifications');
		var config = require('./config.js');

		var push = new Pushover({user:config.pushover.user, token:config.pushover.token});

		push.send(message, function(error, result) {
			if (error) {
				console.error(error);
			}
		});
	};

	_this.notify = function(message) {
		return _this.send({priority:0, message:message});
	};

	_this.error = function(error) {
		return _this.send({priority:1, message:error.message});
	};

	_this.alert = function(error) {
		return _this.send({priority:1, message:error.message});
	};


};

module.exports = new Pushover();
