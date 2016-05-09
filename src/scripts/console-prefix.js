var prefix = module.exports = function(fn) {
	
	var funcs = {
		log: console.log,
		error: console.error,
		warn: console.warn,
		info: console.info
	};
	
	for (var key in funcs) {
		console[key] = function() {
			arguments[0] = fn() + arguments[0];
			funcs[key].apply(console, arguments);
			
		}
	}
	
}