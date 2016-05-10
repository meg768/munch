
var fs        = require('fs');
var sprintf   = require('../../lib/sprintf.js');
var extend    = require('../../lib/extend.js');
var config    = require('../scripts/config.js');


var Portfolio = function() {

	var _this     = this;
	var _holdings = {};
	var _cash     = 100000;
	
	this.holdings = {};
	this.cash     = 100000.0;
	
	this.buy = function(symbol, price, quantity) {
		
		var item = _this.holdings[symbol];
		var value = price * quantity;
		
		if (_this.cash > value) {
			if (item == undefined) {
				item = {};
				item.value = value;
				item.quantity = quantity;
	
				_this.holdings[symbol] = item;

				_this.cash = _this.cash - value;
			}
			else {
				item.quantity = item.quantity + quantity;
				item.value    = item.value + value; 
			}
			
		}
		
	}

	this.sell = function(symbol, price) {
		
		var item = _this.holdings[symbol];
		
		if (item != undefined) {
			
			
		}
		else {
			console.warn(sprintf('Cannot sell %s since we don\'t own it!', symbol));
		}
		
	}

};



