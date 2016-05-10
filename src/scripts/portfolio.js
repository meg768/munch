var fs        = require('fs');
var sprintf   = require('../../lib/sprintf.js');
var extend    = require('../../lib/extend.js');
var config    = require('../scripts/config.js');


var Portfolio = module.exports = function() {

	var _this = this;
	
	this.holdings = {};
	this.cash     = 100000.0;
	

	this.buy = function(symbol, quantity, price) {
		
		price = parseFloat(price);
		quantity = parseInt(quantity);
		
		if (quantity < 0)
			throw new Error('Cannot buy a negative amount.');
			
		var value = price * quantity;
				
		if (_this.cash > value) {
			var item = _this.holdings[symbol];
	
			if (item == undefined) {
				item = {};
				item.value = value;
				item.quantity = quantity;
	
				_this.holdings[symbol] = item;

			}
			else {
				item.quantity = item.quantity + quantity;
				item.value    = item.value + value; 
			}
			
			// Reduce the amount of cash
			_this.cash = _this.cash - value;
			
		}
		else {
			console.warn(sprintf('Cannot afford to buy %s at %.2f', symbol, price));
		}
		
	}

	this.sell = function(symbol, quantity, price) {
		
		price = parseFloat(price);
		quantity = parseInt(quantity);

		if (quantity < 0)
			throw new Error('Cannot sell a negative amount.');

		var value    = quantity * price;		
		var item     = _this.holdings[symbol];
		
		if (item != undefined) {
			if (item.quantity >= quantity) {
				item.quantity = item.quantity - quantity;
				item.value    = item.value - value;
				
				if (item.quantity == 0) {
					delete _this.holdings[symbol];	
				}
				
				_this.cash = _this.cash + value;
			}
			else {
				throw new Error(sprintf('Cannot sell %s more than you have', symbol));
			}
			
		}
		else {
			console.warn(sprintf('Cannot sell %s since we don\'t own it!', symbol));
		}
		
	}
	
	this.order = function(symbol, quantity, price) {
		return quantity > 0 ? _this.buy(symbol, quantity, price) : _this.sell(symbol, -quantity, price);
	}

};



