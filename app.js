var App = require('./src/app.js');


function run() {
	var app = module.exports = new App();	
	app.run();
}	


run();
