var PushoverNotifications = require('pushover-notifications');
var util = require('util');

module.exports = class Pushover {

    constructor(options) {

        options = options || {};

        var user    = options.user ? options.user : process.env.PUSHOVER_USER;
        var token   = options.token ? options.token : process.env.PUSHOVER_TOKEN;
    
        if (user == undefined || token == undefined) {
            throw new Error('Environment variables PUSHOVER_USER and/or PUSHOVER_TOKEN not defined.');
        }

        this.pushover = new PushoverNotifications({user:this.user, token:this.token});
    
    }

    send(payload) {
        try {
            // See https://pushover.net/api for payload parameters

            this.pushover.send(payload, function(error, result) {
                if (error) {
                    console.error(error.stack);
                }
            });
        }
        catch(error) {
            console.error('Failed to send Pushover notification.', error.message);
        }
    }

    error() {
        let text = util.format.apply(util.format, arguments);
        let payload = {priority:1, message:text};
        this.send(payload);
    }
}
