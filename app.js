
var args = require('minimist')(process.argv.slice(2));
var App  = require('./src/app.js');
var app  = module.exports = new App(args);	

app.run();



