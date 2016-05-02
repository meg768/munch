import sprintf from './sprintf.js';

var counter = 0;

var uniqueNumber = module.exports.uniqueNumber = function() {
	return counter++;
}

var uniqueID = module.exports.uniqueID = function() {
	return sprintf('id%d', uniqueNumber());
}
