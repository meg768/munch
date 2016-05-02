var isType = module.exports.isType = function(obj, type) {
	return Object.prototype.toString.call(obj) == '[object ' + type + ']';
};

module.exports.isArray = function(obj) {
	return isType(obj, 'Array');
};

module.exports.isNumber = function(obj) {
	return isType(obj, 'Number');
};

module.exports.isString = function(obj) {
	return isType(obj, 'String');
};

module.exports.isDate = function(obj) {
	return isType(obj, 'Date');
};

module.exports.isObject = function(obj) {
	return obj !== null && isType(obj, 'Object');
};

module.exports.isFunction = function(obj) {
	return typeof obj === 'function';
};
