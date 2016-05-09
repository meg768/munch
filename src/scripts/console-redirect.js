var redirect = module.exports = function(logFile) {

	if (typeof logFile == 'function')
		logFile = logFile();
			
	var fs = require('fs');
	var access = fs.createWriteStream(logFile);

	process.stderr.write = process.stdout.write = access.write.bind(access);
	
	process.on('uncaughtException', function(err) {
		console.error((err && err.stack) ? err.stack : err);
	});			
}
