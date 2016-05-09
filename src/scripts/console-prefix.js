var prefix = module.exports = function(fn) {
	
	var funcs = {
		log: console.log,
		error: console.error,
		warn: console.warn,
		info: console.info
	};
	
	for (var key in funcs) {
		console[key] = function() {
			var output = '';
			var prefix = typeof fn == 'function' ? fn() : fn;
			
			if (typeof arguments[0] == 'string') {
				arguments[0].split('\n').forEach(function(line) {

					if (output != '')
						output += '\n';
						
					output += prefix + line; 	
				});
			}
			else {
				output = prefix + arguments[0];
			}
			
			arguments[0] = output;
			
			funcs[key].apply(console, arguments);
			
		}
	}
	
}