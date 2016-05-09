
function dropboxInstance() {
	var Dropbox    = require('dropbox-node');
	var fs         = require('fs');
	var config     = JSON.parse(fs.readFileSync('.dropbox'));
	
	return new Dropbox.DropboxClient(config.appKey, config.appSecret, config.oAuthAccessToken, config.oAuthAccessTokenSecret);
	
}

module.exports = dropboxInstance();

