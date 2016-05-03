
function dropboxInstance() {
	var Dropbox    = require('dropbox-node');
	var fs         = require('fs');
	var config     = JSON.parse(fs.readFileSync('.dropbox'));
	
	console.log(config.appKey);
	console.log(config.appSecret);
	console.log(config.oAuthAccessToken);
	console.log(config.oAuthAccessTokenSecret);
	
	return new Dropbox.DropboxClient(config.appKey, config.appSecret, config.oAuthAccessToken, config.oAuthAccessTokenSecret);
	
}

module.exports = dropboxInstance();

