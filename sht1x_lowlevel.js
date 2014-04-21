// var gpio = require("../pi-gpio");
// var async = require("../async");

var gpio = require("./HallUt14/client/node_modules/pi-gpio");
var async = require("./HallUt14/client/node_modules/async");

var pinDAT, pinSCK;

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
// 
// DEBUG
// 

// These values are really for 3.5V. Our sensor runs on 3.3V
// so these are not as accurate as possible. Datasheet lists 
// values for different voltages so one can probably interpolate
// values specifically for 3.3V.
var CONVERSION_D1_BOTHP = -39.7;
var CONVERSION_D2_HIGHP = 0.01;
var CONVERSION_D2_LOWP  = 0.04;
var CONVERSION_C1_HIGHP = -2.0468;
var CONVERSION_C1_LOWP  = -2.0468;
var CONVERSION_C2_HIGHP = 0.0367;
var CONVERSION_C2_LOWP  = 0.5872;
var CONVERSION_C3_HIGHP = -1.5955 * 0.000001;
var CONVERSION_C3_LOWP  = -4.0845 * 0.0001;

// Available commands.
var CMD_MEAS_T   = parseInt("00011", 2);
var CMD_MEAS_RH  = parseInt("00101", 2);
var CMD_STATUS_R = parseInt("00111", 2);
var CMD_STATUS_W = parseInt("00110", 2);
var CMD_RESET    = parseInt("11110", 2);

// Local copy of sensors status register. It defaults to 0.
var statusReg = 0;

// Expose two types of measurements.
exports.MEAS_T = CMD_MEAS_T;
exports.MEAS_RH = CMD_MEAS_RH;

// Expose bit location of settings in status register.
exports.STATUS_HEATING      = parseInt("00000100", 2); 
exports.STATUS_NOOTPRELOAD  = parseInt("00000010", 2); 
exports.STATUS_PRECISION    = parseInt("00000001", 2);
exports.STATUS_ENDOFBATTERY = parseInt("01000000", 2);

// Defines a Pin class.
// Makes things easier... Does not send commands if there's no need to.
// E.g., if pin is set to Ouput and it gets a call to set it to Output,
// no command is actually sent.
var Pin = function(pin, value, dir, callback) {
	var self = this;
	self.pinNUM = pin;
	self.pinDIR = dir;
	self.pinVAL = value;

	self.sureOfPinVAL = (self.pinDIR == Pin.OUTPUT ? true : false);

	// Initialize.
	async.series([
		function(next) { gpio.open(pin, dir, next); },
		function(next) { gpio.write(pin, value, next); },
	], callback);
	
	self.destruct = function(callback) {
		gpio.close(self.pinNUM, callback);
	}

	self.setDirection = function(dir, callback) {
		if(dir == self.pinDIR) {
			callback();
			return;
		}
		gpio.setDirection(self.pinNUM, dir, function(err) {
			if(!err) {
				self.pinDIR = dir;
				if(dir == Pin.INPUT) {
					self.sureOfPinVAL = false;
				}
			}
			callback(err);
		});
	}

	self.write = function(value, callback) {
		if(self.sureOfPinVAL && self.pinVAL == value) {
			callback();
			return;
		}
		async.series([
			function(next) { self.setDirection(Pin.OUTPUT, next); },
			function(next) {
				gpio.write(self.pinNUM, value, function(err) {
					if(!err) {
						self.pinVAL = value;
						self.sureOfPinVAL = true;
						delay(next);
					} else {
						next(err);
					}
				});
			},
		], callback);
	}

	self.read = function(callback) {
		async.series([
			function(next) { self.setDirection(Pin.INPUT, next); },
			function(next) { 
				gpio.read(self.pinNUM, function(err, result) {
					if(err) {
						next(err);
					} else {
						delay(function() { next(err, result); });
					}
				});
			},
		], function(err, result) { callback(err, result[1]); });
	}
}
Pin.OUTPUT = "out";
Pin.INPUT = "in";
function delay(callback) {
	setTimeout(callback, 2);
}

function tick(callback) {
	async.series([
		function(next) { pinSCK.write(1, next); },
		function(next) { pinSCK.write(0, next); },
	], callback);
}

function reverseByte(val) {
	function b2d(val) { return parseInt(val, 2); }
	val = ((val & b2d("11110000")) >> 4) | ((val & b2d("00001111")) << 4);
	val = ((val & b2d("11001100")) >> 2) | ((val & b2d("00110011")) << 2);
	val = ((val & b2d("10101010")) >> 1) | ((val & b2d("01010101")) << 1);
	return val;
}

/**
 * CLK: __/^^^\___/^^^\__ 
 * DAT: ^^^^\_______/^^^^ 
 */
function initTransmission(callback) {
	console.log("Init transmission");
	async.series([
		function(next) { pinDAT.write(1, next); },
		function(next) { pinSCK.write(0, next); },
		function(next) { pinSCK.write(1, next); },
		function(next) { pinDAT.write(0, next); },
		function(next) { pinSCK.write(0, next); },
		function(next) { pinSCK.write(1, next); },
		function(next) { pinDAT.write(1, next); },
		function(next) { pinSCK.write(0, next); },
	], callback);
}

function readByte(sendACK, callback) {
	async.timesSeries(8, function(n, next) {
		async.series([
			function(next) { pinDAT.read(next); },
			tick,
		], function(err, result) { next(err, result[0]); });
	}, function(err, result) {
		if(err) {
			callback(err);
		} else {
			var val = parseInt(result.toString().replace(/,/g, ""), 2);
			if(sendACK) {
				ACKReadByte(function(err) { callback(err, val); });
			} else {
				callback(err, val);
			}
		}
	});
}

function sendByte(val, callback) {
	console.log("Send byte");
	async.timesSeries(8, function(n, next) {
		async.series([
			function(next) { pinDAT.write((val >> (7 - n)) & 1, next); },
			tick,
		], next);
	}, function(err) {
		if(err) {
			callback(err);
		} else {
			ACKSentByte(callback);
		}
	});
}

function ACKReadByte(callback) {
	async.series([
		function(next) { pinDAT.write(0, next); },
		tick,
	], callback);
}

function ACKSentByte(callback) {
	async.series([
		pinDAT.read,
		tick,
		pinDAT.read,
	], function(err, result) {
		console.log("%j",  result);
		if(err || (result[0] == 0 && result[2] == 1)) {
			callback(err);
		} else { 
			callback("Got no ACK on sent byte.");
		}
	});
}

exports.initPins = function(pinDAT_P, pinSCK_P, callback) {
	start = new Date().getTime();
	async.series([
		function(callback) { pinDAT = new Pin(pinDAT_P, 1, Pin.OUTPUT, callback); },
		function(callback) { pinSCK = new Pin(pinSCK_P, 0, Pin.OUTPUT, callback); },
	], callback);
}

exports.destructPins = function(callback) {
	async.series([
		pinDAT.destruct,
		pinSCK.destruct,
	], callback);
}

exports.resetCommunication = function(callback) {
	console.log("Reset communication.");
	async.series([
		function(next) { pinDAT.write(1, next); },
		function(next) {
			async.timesSeries(9, function(n, next) { tick(next); }, next);
		},
	], callback);
}

exports.softReset = function(callback) {
	async.series([
		resetCommunication,
		initTransmission,
		function(next) { sendByte(CMD_SOFT_RESET); },
	], callback);
}

exports.measure = function(type, callback) {
	console.log("Measure");
	function waitForResults(callback) {
		console.log("Wait for results");
		var val;
		async.doWhilst(function(callback) {
			setTimeout(function() {
				pinDAT.read(function(err, result) {
					val = result;
					callback(err);
				});
			}, 100);
		}, function() {
			if(val != 1) {
				console.log("Done waiting.");
			}
			return val == 1;
		}, callback);
	}

	// func(aCallback)
	//   aCallback(error, result)
	async.series([
		initTransmission,
		function(next) { sendByte(type, next); },
		waitForResults,
		function(next) { readByte(true, next); },
		function(next) { readByte(false, next); },
	], function(err, result) {
		if(err) {
			callback(err);
		} else {
			console.log("meas: %j", result);
			callback(err, (result[3] << 8) | result[4]); 
		}
	});
}
// most signi ---> 0 ... 01101 ... 1 <-- least signi
exports.convertToCelcius = function(val) {
	// If set, low precision is set.
	if(statusReg & exports.STATUS_PRECISION) {
		return CONVERSION_D1_BOTHP + CONVERSION_D2_LOWP * val;
	} else {
		return CONVERSION_D1_BOTHP + CONVERSION_D2_HIGHP * val;
	}
}

exports.convertToRelativeHumidity = function(val) {
	// If set, low precision is set.
	if(statusReg & exports.STATUS_PRECISION) {
		return CONVERSION_C1_LOWP + CONVERSION_C2_LOWP * val + CONVERSION_C3_LOWP * val * val;
	} else {
		return CONVERSION_C1_HIGHP + CONVERSION_C2_HIGHP * val + CONVERSION_C3_HIGHP * val * val;
	}
}









// var old_gpio_write = gpio.write;
// gpio.write = function(pin, value, callback) {
// 	var pinName = "boogey";
// 	if(pin == dataPin) {
// 		pinName = "Data Pin";
// 	} else if(pin == clkPin) {
// 		pinName = "Clk Pin ";
// 	}
// 	console.log("(" + pinName + ", " + value + ")");
// 	setTimeout(function() { old_gpio_write(pin, value, callback); }, 10);
// }

// var old_gpio_read = gpio.read;
// gpio.read = function(pin, callback) {
// 	var pinName = "boogey";
// 	if(pin == dataPin) {
// 		pinName = "Data Pin";
// 	} else if(pin == clkPin) {
// 		pinName = "Clk Pin ";
// 	}
// 	console.log("(" + pinName + ")");
// 	setTimeout(function() { old_gpio_read(pin, callback); }, 10);
// }

// var old_gpio_setDirection = gpio.setDirection;
// gpio.setDirection = function(pin, dir, callback) {
// 	var pinName = "boogey";
// 	if(pin == dataPin) {
// 		pinName = "Data Pin";
// 	} else if(pin == clkPin) {
// 		pinName = "Clk Pin ";
// 	}
// 	console.log("(" + pinName + ", " + dir + ")");
// 	setTimeout(function() { old_gpio_setDirection(pin, dir, callback); }, 10);
// }

// var CMD_MEASURE_TEMPERATURE   = parseInt("00011", 2);
// var CMD_MEASURE_RELHUMIDITY   = parseInt("00101", 2);
// var CMD_READ_STATUS_REGISTER  = parseInt("00111", 2);
// var CMD_WRITE_STATUS_REGISTER = parseInt("00110", 2);
// var CMD_SOFT_RESET            = parseInt("11110", 2);

// exports.MEASURE_TEMPERATURE = CMD_MEASURE_TEMPERATURE;
// exports.MEASURE_RELHUMIDITY = CMD_MEASURE_RELHUMIDITY;

// exports.STATUS_HEATING      = parseInt("00000100", 2); 
// exports.STATUS_NOOTPRELOAD  = parseInt("00000010", 2); 
// exports.STATUS_PRECISION    = parseInt("00000001", 2);
// exports.STATUS_ENDOFBATTERY = parseInt("01000000", 2);

// // Status defaults to 0, see sensor datasheet.
// var statusReg = 0; 

// var dataPin;
// var clkPin;

// // Names taken from sensor datasheet. Temperature values are for celsius.
// // P is for Precision.
// var CONVERSION_D1_BOTHP = -39.7;
// var CONVERSION_D2_HIGHP = 0.01;
// var CONVERSION_D2_LOWP  = 0.04;

// var CONVERSION_C1_HIGHP = -2.0468;
// var CONVERSION_C1_LOWP  = -2.0468;
// var CONVERSION_C2_HIGHP = 0.0367;
// var CONVERSION_C2_LOWP  = 0.5872;
// var CONVERSION_C3_HIGHP = -1.5955 * 0.000001;
// var CONVERSION_C3_LOWP  = -4.0845 * 0.0001;

// /**
//  * T = D1 + D2 * val
//  */
// exports.convertToCelcius = function(val) {
// 	// If set, low precision is set.
// 	if(statusReg & exports.STATUS_PRECISION) {
// 		return CONVERSION_D1_BOTHP + CONVERSION_D2_LOWP * val;
// 	} else {
// 		return CONVERSION_D1_BOTHP + CONVERSION_D2_HIGHP * val;
// 	}
// }

// /**
//  * RH = C1 + C2 * val + C3 * val * val
//  */
// exports.convertToRelativeHumidity = function(val) {
// 	console.log(CONVERSION_C1_LOWP, CONVERSION_C2_LOWP, CONVERSION_C3_LOWP);
// 	// If set, low precision is set.
// 	if(statusReg & exports.STATUS_PRECISION) {
// 		return CONVERSION_C1_LOWP + CONVERSION_C2_LOWP * val + CONVERSION_C3_LOWP * val * val;
// 	} else {
// 		return CONVERSION_C1_HIGHP + CONVERSION_C2_HIGHP * val + CONVERSION_C3_HIGHP * val * val;
// 	}
// }

// exports.getCurrentStatus = function() {
// 	return statusReg;
// }

// /**
//  * Callback = f(error)
//  * Assumes nothing about the state of things.
//  * Leaves clkPin and dataPin set to output.
//  * Leaves clkPin as low and dataPin as high.
//  */
// exports.resetConnection = function(callback) {
// 	console.log("Reset");
// 	async.series([
// 		function(next) { gpio.setDirection(dataPin, "out", next); },
// 		function(next) { gpio.setDirection(clkPin, "out", next); },
// 		function(next) { gpio.write(dataPin, 1, next); },
// 		function(next) { gpio.write(clkPin, 0, next); },
// 		function(next) { 
// 			async.timesSeries(9, function(n, next) {
// 				tickClock(next);
// 			}, next);
// 		},
// 	], callback);
// }

// exports.openPins = function(passedDataPin, passedClkPin, callback) {
// 	console.log("Open");
// 	dataPin = passedDataPin;
// 	clkPin = passedClkPin;
// 	async.series([ // TODO: see if it's okey to change to .parallel
// 		function(next) { gpio.open(dataPin, "", next); },
// 		function(next) { gpio.open(clkPin, "", next); },
// 		exports.resetConnection,
// 	], callback);
// }

// exports.closePins = function(callback) {
// 	console.log("Close");
// 	async.series([ // TODO: see if it's okey to change to .parallel
// 		function(callback) { gpio.close(dataPin, callback); },
// 		function(callback) { gpio.close(clkPin, callback); },
// 	], callback);
// }

// *
//  * Callback = f(error, result)
 
// exports.makeMeasurement = function(type, callback) {
// 	console.log("Measure");
// 	async.series([
// 		function(next) { initiateTransmission(next); },
// 		function(next) { sendByte(type, next); },
// 		function(next) { setTimeout(next, 200); },
// 		function(next) { receiveByte(ACKReceivedByte, next); },
// 		function(next) { receiveByte(ACKEndTransmission, next); },
// 	], function(err, result) {
// 		callback(err, (result[3] << 7) + result[4]);
// 	});
// }

// /**
//  * Callback = f(error, result)
//  */
// exports.readStatus = function(callback) {
// 	console.log("Read status");
//  	async.series([
//  		function(next) { initiateTransmission(next); },
// 		function(next) { sendByte(CMD_READ_STATUS_REGISTER, next); },
// 		function(next) { receiveByte(ACKEndTransmission, next); },
//  	], function(err, result) {
//  		callback(err, result[2]);
// 	});
// }


// /**
//  * Callback = f(error)
//  * Assumes datapin is set high and clkPin low.
//  * Leaves them in this position too.
//  * Assumes datapin is set to output when entering.
//  * Leaves datapin set to output when leaving.
//  * CLK: __/^^^\___/^^^\__ 
//  * DAT: ^^^^\_______/^^^^ 
//  */
// function initiateTransmission(callback) {
// 	console.log("Initiate");
// 	async.series([
// 		function(next) { gpio.write(clkPin, 1, next); },
// 		function(next) { gpio.write(dataPin, 0, next); },
// 		function(next) { gpio.write(clkPin, 0, next); },
// 		function(next) { gpio.write(clkPin, 1, next); },
// 		function(next) { gpio.write(dataPin, 1, next); },
// 		function(next) { gpio.write(clkPin, 0, next); },
// 	], callback);
// }

// /**
//  * Callback = f(error)
//  * Handles ACK.
//  */
// function sendByte(data, callback) {
// 	console.log("Send byte");
// 	async.timesSeries(8, function(n, next) {
// 		async.series([
// 			function(next) { gpio.write(dataPin, (data >> (7 - n)) & 1, next); },
// 			function(next) { tickClock(next); },
// 		], next);
// 	}, function(err) {
// 		if(err) {
// 			callback(err);
// 		} else {
// 			ACKSentByte(callback);
// 		}
// 	});
// }

// /** 
//  * Callback = f(error, result)
//  * Handles ACK.
//  */
// function receiveByte(ACKType, callback) {
// 	console.log("Receive byte");
// 	async.timesSeries(8, function(n, next) {
// 		async.series([
// 			function(next) { tickClock(next); },
// 			function(next) { gpio.read(dataPin, next); },
// 		], function(err, result) {
// 			next(err, result[1]);
// 		});
// 	}, function(err, result) {
// 		if(err) {
// 			callback(err);
// 		} else {
// 			ACKType(function(err) {
// 				// result is an array of bits. this turns it into a decimal numerical
// 				callback(err, parseInt(result.toString().replace(/,/g, ""), 2));
// 			});
// 		}
// 	});
// }

// /**
//  * Manipulation of clock (other than initial setup) should be done through this method.
//  * Callback = f(error)
//  */
// function tickClock(callback) {
// 	console.log("Tick");
// 	async.series([
// 		function(next) { gpio.write(clkPin, 1, next); },
// 		function(next) { gpio.write(clkPin, 0, next); },
// 	], callback);
// }

// /**
//  * Assumes datapin is set to output when entering.
//  * Leaves datapin set to input when leaving.
//  */
// function ACKSentByte(callback) {
// 	console.log("ACK Sent Byte");
// 	async.series([
// 		function(next) { gpio.setDirection(dataPin, "in", next); },
// 		function(next) { gpio.read(dataPin, next); },
// 		function(next) { tickClock(next); },
// 		function(next) { gpio.read(dataPin, next); },
// 	], function(err, result) {
// 		if(err) {
// 			callback(err);
// 		} else if(result[1] != 0 || result[3] != 1) {
// 			callback("Sent byte did not get ACKed.");
// 		} else {
// 			callback();
// 		}
// 	});
// }

// /**
//  * Assumes datapin is set to input when entering.
//  * Leaves datapin set to input when leaving.
//  */
// function ACKReceivedByte(callback) {
// 	console.log("ACK ReceivedByte Byte");
// 	async.series([
// 		function(next) { gpio.setDirection(dataPin, "out", next); },
// 		function(next) { gpio.write(dataPin, 0, next); },
// 		function(next) { tickClock(next); },
// 		function(next) { gpio.setDirection(dataPin, "in", next); },
// 	], callback);
// }

// /**
//  * Assumes datapin is set to input when entering.
//  * Leaves datapin set to output when leaving.
//  */
// function ACKEndTransmission(callback) {
// 	console.log("ACK End Transmission");
// 	async.series([
// 		function(next) { gpio.setDirection(dataPin, "out", next); },
// 		function(next) { gpio.write(dataPin, 1, next); },
// 		function(next) { tickClock(next); },
// 	], callback);
// }
