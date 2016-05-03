var Downloader = require('./src/downloader.js');
var args       = require('minimist')(process.argv.slice(2));
var Dropbox    = require('./src/dropbox.js');
var fs         = require('fs');

var App = function() {

	this.scheduleDownload = function() {
		var downloader = new Downloader(require('./src/stocks.js').symbols);
		downloader.scheduleDownload();
		
	};
}


function main() {
	var app = new App();
	
	var json = fs.readFileSync('.dropbox');

	json = JSON.parse(json);
	console.log(json);

	if (args.download) {
		app.scheduleDownload();
	}
/*
	console.log(json.appKey);
	console.log(json.appSecret);
	console.log(json.oAuthAccessToken);
	console.log(json.oAuthAccessTokenSecret);
	
//	var dropbox = new Dropbox.DropboxClient('qdp1hpbvietvzw4', '7b7dfeqk9dhdpuc', '1s6fsmerqmodfrra', 'hfh43q5uctaxffg');
	var dropbox = new Dropbox.DropboxClient(json.appKey, json.appSecret, json.oAuthAccessToken, json.oAuthAccessTokenSecret);
*/	
	//dropbox.getAccessToken('magnus@egelberg.se', 'potatismos', function (err, token, secret) {
	
	//console.log(err, token, secret);
	  // Upload foo.txt to the Dropbox root directory.
	  Dropbox.putFile('app.js', 'Data/Quotes/Foo/app.js', function (err, data) {
	    if (err) return console.error(err)
	
	  });
		
	//});
}	


main();


/*
	
var Downloader = require('./src/downloader.js');
var args       = require('minimist')(process.argv.slice(2));
var Dropbox    = require('dropbox-node');
var fs         = require('fs');

var App = function() {

	this.scheduleDownload = function() {
		var downloader = new Downloader(require('./src/stocks.js').symbols);
		downloader.scheduleDownload();
		
	};
}


function main() {
	var app = new App();
	
	var json = fs.readFileSync('/Users/Magnus/.dropbox-apps.json');
	console.log('asdkfjhalsdkjfh');
	json = JSON.parse(json);
console.log(json);
	if (args.download) {
		app.scheduleDownload();
	}

	var dropbox = new Dropbox.DropboxClient(json.meg768.appKey, json.meg768.appSecret, json.meg768.oAuthAccessToken, json.meg768.oAuthAccessTokenSecret);
	
	//dropbox.getAccessToken('magnus@egelberg.se', 'potatismos', function (err, token, secret) {
	
	//console.log(err, token, secret);
	  // Upload foo.txt to the Dropbox root directory.
	  dropbox.putFile('app.js', 'app.js', function (err, data) {
	    if (err) return console.error(err)
	
	  });
		
	//});
}	


main();	
	
	*/