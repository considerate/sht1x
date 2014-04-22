var gpio = require('pi-gpio');
var thunkify = require('thunkify');
var wait = require('co-wait');

// Defines a Pin class.
// Makes things easier... Does not send commands if there's no need to.
// E.g., if pin is set to Ouput and it gets a call to set it to Output,
// no command is actually sent.

var write = thunkify(gpio.write);
var read = thunkify(gpio.read);
var setDirection = thunkify(gpio.setDirection);
var open = thunkify(gpio.open);
var close = thunkify(gpio.close);

function Pin(pin, value, dir) {
	if(!this instanceof Pin) {
		return new Pin(pin, value, dir);
	}
	this.number = pin;
	this.dir = dir;
	this.val = value;
	if(dir === Pin.OUTPUT) {
		this.valueKnown = true;
	} else {
		this.valueKnown = false;
	}
}

Pin.OUTPUT = "out";
Pin.INPUT = "in";

var pin = Pin.prototype;

pin.init = function*() {
	// Initialize.
	yield open(this.number, this.dir);
	yield setDirection(this.number, this.dir);
	yield write(this.number, this.val);	
};

pin.close = function*() {
	yield close(this.number);
};

pin.setDirection = function*(dir) {
	if(dir === this.dir) {
		return;
	}
	yield setDirection(this.number, dir);
	this.dir = dir;
	if(dir === Pin.INPUT) {
		this.valueKnown = false;
	}
};

pin.get = function* () {
	if(this.valueKnown) {
		return this.val;
	}
	var val = yield this.read();
	return val;
};

pin.write = function* (value) {
	if(this.valueKnown && this.val === value) {
		return;
	}
	yield this.setDirection(Pin.OUTPUT);
	yield write(this.number, value);
	//yield wait(2);
	this.val = value;
	this.valueKnown = true;
};

pin.read = function* () {
	yield this.setDirection(Pin.INPUT);
	var result = yield read(this.number);
	//yield wait(2);
	return result;
};

module.exports = Pin;
