var gpio = require('pi-gpio');
var thunkify = require('thunkify');

// Defines a Pin class.
// Makes things easier... Does not send commands if there's no need to.
// E.g., if pin is set to Ouput and it gets a call to set it to Output,
// no command is actually sent.

var write = thunkify(gpio.write);
var read = thunkify(gpio.read);
var setDirection = thunkify(gpio.setDirection);
var open = thunkify(gpio.open);
var close = thunkify(gpio.close);

var Pin = function(pin, value, dir) {
	this.pinNUM = pin;
	this.pinDIR = dir;
	this.pinVAL = value;

	this.sureOfPinVAL = (this.pinDIR == Pin.OUTPUT ? true : false);
}

Pin.OUTPUT = "out";
Pin.INPUT = "in";

Pin.protoype.init = function*() {
	// Initialize.
	yield open(pin, dir);
	yield write(pin, value);	
}

Pin.protoype.close = function() {
	yield close(this.pinNUM);
}

Pin.protoype.setDirection = function*(dir) {
	if(dir == this.pinDIR) {
		return;
	}
	yield setDirection(this.pinNUM, dir);
	this.pinDIR = dir;
	this.sureOfPinVAL = false;
}

Pin.protoype.write = function* (value) {
	if(this.sureOfPinVAL && this.pinVAL === value) {
		callback();
		return;
	}
	yield this.setDirection(Pin.OUTPUT);
	yield write(this.pinNUM, value);
	//yield wait(2);
	this.pinVAL = value;
	this.sureOfPinVAL = true;
}

Pin.protoype.read = function* () {
	yield this.setDirection(Pin.INPUT);
	var result = yield read(this.pinNUM);
	//yield wait(2);
	return result;
}

module.exports = Pin;


/*


var start = new Date().getTime();
var last;

// 
// DEBUG
// 
function pt() {
	return new Date().getTime() - start;
}

function pinName(pin) {
	var pinName = "boogey";
	if(pin == pinDAT.pinNUM) {
		pinName = "Data Pin";
	} else if(pin == pinSCK.pinNUM) {
		pinName = "Clk Pin ";
	}
	return pinName;
}


var old_gpio_write = gpio.write;
gpio.write = function(pin, value, callback) {
	var time;
	if(!last) {
		last = new Date().getTime();
		time = "-";
	} else {
		oldLast = last;
		last = new Date().getTime();
		time = new Date().getTime() - oldLast;
	}
	console.log("W (" + pinName(pin) + ", " + value + ") " + time);
	setTimeout(function() { old_gpio_write(pin, value, callback); }, 10);
}

var old_gpio_read = gpio.read;
gpio.read = function(pin, callback) {
	setTimeout(function() { old_gpio_read(pin, function(err, result) {
		if(err) {
			callback(err);
		} else {
			var time;
			if(!last) {
				last = new Date().getTime();
				time = "-";
			} else {
				oldLast = last;
				last = new Date().getTime();
				time = new Date().getTime() - oldLast;
			}
			console.log("R (" + pinName(pin) + ", " + result + ") " + time);
			callback(err, result);
		}
	}); }, 10);
}

var old_gpio_setDirection = gpio.setDirection;
gpio.setDirection = function(pin, dir, callback) {
	var time;
	if(!last) {
		last = new Date().getTime();
		time = "-";
	} else {
		oldLast = last;
		last = new Date().getTime();
		time = new Date().getTime() - oldLast;
	}
	console.log("D (" + pinName(pin) + ", " + dir + ") " + time);
	setTimeout(function() { old_gpio_setDirection(pin, dir, callback); }, 10);
} 
*/