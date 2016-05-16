var fs = require('fs');

function init() {

	var stocks = {};
	
	var data = JSON.parse(fs.readFileSync('./src/scripts/stocks.json'));
	
	data.forEach(function(item) {
		item.symbol = item.symbol.trim();
		item.sector = item.sector.trim();
		
		stocks[item.symbol] = item;
	});

	module.exports = stocks;
		 
		
}

init();
