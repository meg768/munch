
var fs        = require('fs');
var sprintf   = require('yow').sprintf;

var config    = require('../scripts/config.js');
var stocks    = require('../scripts/stocks.js');
var Portfolio = require('../scripts/portfolio.js');

var Module = module.exports = function(args) {

	function toString(json) {
		return JSON.stringify(json, null, '\t');
	}
	var array = [];
	
	for (var key in stocks) {
		array.push(stocks[key]);
	}
	array.sort(function(a, b){
		return a.symbol.localeCompare(b.symbol);
	});
	fs.writeFileSync("stocks.json", JSON.stringify(array, null, '\t'));
/*
	
	this.run = function() {

		var portfolio = new Portfolio();
		
		portfolio.buy('AAPL', 10, 100);
		portfolio.buy('AAPL', 20, 10);
		console.log('Cash', portfolio.cash);
		portfolio.sell('AAPL', portfolio.holdings['AAPL'].quantity, 40);
		
		console.log(toString(portfolio.holdings));
		console.log('Cash', portfolio.cash);
	}
*/

	
};


