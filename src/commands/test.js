
var fs       = require('fs');
var sprintf  = require('../../lib/sprintf.js');

var config  = require('../scripts/config.js');
var stocks  = require('../scripts/stocks.js');
var Portfolio = require('../scripts/portfolio.js');

var Module = module.exports = function(args) {

	function toString(json) {
		return JSON.stringify(json, null, '\t');
	}

	this.run = function() {

		var portfolio = new Portfolio();
		
		portfolio.buy('AAPL', 10, 100);
		portfolio.buy('AAPL', 20, 10);
		console.log('Cash', portfolio.cash);
		portfolio.sell('AAPL', portfolio.holdings['AAPL'].quantity, 40);
		
		console.log(toString(portfolio.holdings));
		console.log('Cash', portfolio.cash);
	}


	
};


