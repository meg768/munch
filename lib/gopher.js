var clientRequest = require('client-request');
var isString = require('./utils.js').isString;
var isObject = require('./utils.js').isObject;
var isArray = require('./utils.js').isArray;
var Promise = require('bluebird');


var Gopher = module.exports = function(baseURL) {
	

	this.request = function(method, path, params, headers) {

		function buildPath(path, params) {
			
			var parts = [];
			
			path.split('/').forEach(function(part) {
				if (part[0] == '{' && part[part.length - 1] == '}') {
					var name = part.slice(1, -1);
					
					if (params[name] != undefined) {
						parts.push(params[name]);
						delete params[name]
					}
					else	
						parts.push(part);
				}
				else
					parts.push(part);
					
			});		
			
			return parts.join('/');
		};

		function buildParams(params) {
			
			if (params == undefined)
				params = {};
				
			function uriEncode(value) {
			
				if (isArray(value)) {
					value = value.join(',');
				} 
				else if (isObject(value)) {
					value = JSON.stringify(value);
				}
				//return value;
				return encodeURIComponent(value);
			}

			//return Object.keys(params).map(key => encodeURIComponent(key) + '=' + uriEncode(params[key])).join('&');

			var array = Object.keys(params).map(function(key) {
				return encodeURIComponent(key) + '=' + uriEncode(params[key]);
			});
			
			return array.join('&');
		}
		
		function buildHeaders(headers) {

			var result = {};
			
			if (isObject(headers)) {
				Object.keys(headers).forEach(function(key) {
					result[key.toLowerCase()] = headers[key];
				});
			}

			return result;
		};
		
		function buildBody(method, params, headers) {

			if (method == 'post' || method == 'put') {
				if (headers['content-type'] == 'application/json') {
					return JSON.stringify(params);
				}
				if (headers['content-type'] == 'application/x-www-form-urlencoded') {
					return buildParams(params);
				}
			}
		}
		
		function buildQuery(method, params) {
			if (method == 'get' || method == 'delete') {
				return buildParams(params);
			}
			
			return '';

		}

		function buildURI(method, path, params) {
			var path  = buildPath(path, params);
			var query = buildQuery(method, params);

			return baseURL + '/' + (query == '' ? path : path + '?' + query);
		}
		
		var options = {};
		options.method  = method.toLowerCase();
		options.uri     = buildURI(options.method, path, params);
		options.headers = buildHeaders(headers);
		options.body    = buildBody(method, params, options.headers);

		return new Promise(function(resolve, reject) {

			clientRequest(options, function (error, response, body) {

				if (!error && response.statusCode == 200) {
					
					var contentType = '';
					
					if (response.headers && isString(response.headers['content-type'])) {
						contentType = response.headers['content-type'];
					}
					

					if (contentType.match("application/json")) {
						var json = {};
						
						try {
							json = JSON.parse(body);
							console.log(json);
						}

						catch (error) {
							reject('JSON parse error.');
						}
		
						resolve(json);
					}
					else {
						resolve(body.toString());
					}
				}
				else {
					//console.log(response);
					reject(error, response, body);
					
				}
			});
			
		});
	}


};


