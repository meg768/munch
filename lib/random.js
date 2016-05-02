


module.exports.rand = function(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;	
}

	
module.exports.choose = function(items) {
	return items[Math.floor((Math.random() * items.length))];
}
	




