

var EventEmitter = module.exports = function(context) {
	
	var _this = this;

	var _eventMap = {};
	var _context = context;

	function parse(name) {

		var events = []; 
		
		if (typeof name == 'string') {
			var names = name.split(' ');
			
			names.forEach(function(name) {
				var split = name.indexOf('.');
				var event = {};
				
				if (split < 0) {
					event.name = name;
					event.namespace = undefined;
				}
				else {
					event.name = name.substr(split + 1);
					event.namespace = name.substr(0, split);
				}
				
				events.push(event);
			});
		}

		return events;
	}

	_this.on = function(name, callback) {

		var events = parse(name);
		
		events.forEach(function(event) {
			var item = {callback:callback, namespace:event.namespace};
			
			if (_eventMap[event.name] == undefined)
				_eventMap[event.name] = [item];		
			else
				_eventMap[event.name].push(item);
			
		});
			
	}; 

	_this.off = function(name) {

		if (name == undefined) {
			_eventMap = {};
		}
		else {
			var events = parse(name);
			
			events.forEach(function(event) {
				if (event.namespace == undefined) {
					delete _eventMap[event.name];
				}
				else {
					for (var name in _eventMap) {
						var listeners = _eventMap[name];
						
						for (var index = listeners.length - 1; index >= 0; index--) {
							if (listeners[index].namespace == event.namespace)
								listeners.splice(index, 1);
						}
						
						// If none left, remove from map
						if (listeners.length == 0)
							delete _eventMap[name];
					}
				}
				
			});
		}
	}; 
	
	_this.emit = function(name) {
		var args   = Array.prototype.slice.call(arguments, 1);
		var events = parse(name);
		
		events.forEach(function(event) {
			var listeners = _eventMap[event.name];
			
			if (listeners != undefined) {
				listeners.forEach(function(listener) {
					if (event.namespace == undefined || listener.namespace == event.namespace)
						listener.callback.apply(_context, args);
				});
			}
			
		});
	}; 

	_this.setContext = function(context) {
		_context = context;
	};
	
	_this.removeAllListeners = function() {
		_eventMap = [];
	}
	
};

/*
	
function test() {

	var assert = require('assert');
	var counter = 0;
	var param = '';
	
	function callback(params) {
		counter++;
		param = arguments[0];
	}

	var events = new EventEmitter();
	

	events.on('tap', callback);
	//console.log(events.eventMap);
	assert(Object.keys(events.eventMap).length == 1);

	events.off('tap');
	//console.log(events.eventMap);
	assert(Object.keys(events.eventMap).length == 0);

	counter = 0;
	param = '';
	events.on('tap', callback);
	//console.log(events.eventMap);
	events.emit('tap', 'HEJ');
	assert(param == 'HEJ');


	events.off();
	assert(Object.keys(events.eventMap).length == 0);
	
	// Add with namespace
	events.on('button.click', callback);
	console.log(events.eventMap);
	assert(Object.keys(events.eventMap).length == 1);
	assert(events.eventMap['click'][0].namespace == 'button');

	counter = 0;
	events.emit('click');
	console.log('-----------');
	console.log(events.eventMap);
	console.log('Click count', counter);
	assert(counter == 1);

	counter = 0;
	events.on('button.click', callback);
	console.log(events.eventMap);
	events.emit('click');
	assert(counter == 2);

	counter = 0;
	events.on('click', callback);
	console.log(events.eventMap);
	events.emit('click');
	assert(counter == 3);

	events.off('button.click');	
	console.log(events.eventMap);
	assert(Object.keys(events.eventMap).length == 1);

	events.off();
	assert(Object.keys(events.eventMap).length == 0);


	// Add with namespace
	events.on('button.click', callback);
	assert(Object.keys(events.eventMap).length == 1);
	assert(events.eventMap['click'][0].namespace == 'button');

	events.on('menu.click', callback);
	assert(Object.keys(events.eventMap).length == 1);
	assert(events.eventMap['click'][1].namespace == 'menu');
	
	events.off('click');
	assert(Object.keys(events.eventMap).length == 0);

	counter = 0;
	events.on('button.click', callback);
	events.on('button.click', callback);
	events.emit('button.click', callback);
	assert(counter == 2);

	counter = 0;
	events.on('menu.click', callback);
	events.on('listbox.click', callback);
	events.emit('click', callback);
	console.log(events.eventMap);
	assert(counter == 4);
	
	events.off('menu.click listbox.click button.click');
	console.log(events.eventMap);
	assert(Object.keys(events.eventMap).length == 0);

	events.on('button.click button.click listbox.click menu.dropdown', callback);
	assert(Object.keys(events.eventMap).length == 2);

	counter = 0;
	events.emit('click');
	assert(counter == 3);

	counter = 0;
	events.emit('click dropdown');
	assert(counter == 4);

	counter = 0;
	events.emit('click.dropdown');
	assert(counter == 0);
	
}

test();
*/
