// var gpio = require("../pi-gpio");
// var async = require("../async");

var gpio = require("./HallUt14/client/node_modules/pi-gpio");
var async = require("./HallUt14/client/node_modules/async");
var Pin = require('./pin');
var co = require('co');
var wait = require('co-wait');

var pinDAT, pinSCK;
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


function* tick() {
	yield pinSCK.write(1);
	yield pinSCK.write(0);
}
var reverseByte = (function initReverseByte() {
	function b2d(val) { 
		return parseInt(val, 2); 
	}

	//Constants for reverseByte
	var _11110000 = b2d('11110000');
	var _00001111 = b2d('00001111');
	var _11001100 = b2d('11001100');
	var _00110011 = b2d('00110011');
	var _10101010 = b2d('10101010');
	var _01010101 = b2d('01010101');

	return function reverseByte(val) {
		val = ((val & _11110000) >> 4) | ((val & _00001111) << 4);
		val = ((val & _11001100) >> 2) | ((val & _00110011) << 2);
		val = ((val & _10101010) >> 1) | ((val & _01010101) << 1);
		return val;
	}
})();

/**
 * CLK: __/^^^\___/^^^\__ 
 * DAT: ^^^^\_______/^^^^ 
 */
function* initTransmission(callback) {
	console.log("Init transmission");
	yield pinDAT.write(1)
	yield pinSCK.write(0)
	yield pinSCK.write(1)
	yield pinDAT.write(0)
	yield pinSCK.write(0)
	yield pinSCK.write(1)
	yield pinDAT.write(1)
	yield pinSCK.write(0)	
}

function* readByte(options) {
	var ack = options.ack;
	var reads = [];
	for(var i = 0; i < 8; i++) {
		var val = yield pinDAT.read(); 
		yield tick();
		reads.push(val);
	}
	var bits = reads.join(''); //Concat all read bits (empty string join)
	var val = parseInt(bits, 2);
	if(ack) {
		yield ACKReadByte();	
	}
	return val;
}

function* sendByte(val) {
	console.log("Send byte");
	for(var i = 0; i < 8; i ++) {
		//Write bit i of val to pinDAT
		yield pinDAT.write((val >> (7 - i)) & 1);	
		yield tick();	
	}
	yield ACKSentByte();
}

function* ACKReadByte() {
	yield pinDAT.write(0);
	yield tick();
}

function* ACKSentByte() {
	var a = yield pinDAT.read();
	yield tick();
	var b = yield pinDAT.read();
	if(a == 0 && b == 1) {
		return;
	} else {
		throw Error("Got no ACK on sent byte.")
	}
}

exports.initPins = function*(options) {
	pinDAT = new Pin(options.dataPin, 1, Pin.OUTPUT);
	pinSCK = new Pin(options.clockPin, 0, Pin.OUTPUT);
	yield pinDAT.init();
	yield pinSCK.init();
}

exports.destructPins = function(callback) {
	yield pinDAT.close();
	yield pinSCK.close();
}

exports.resetCommunication = function*() {
	console.log("Reset communication.");
	yield pinDAT.write(1, next);
	for(var i = 0; i < 9; i++) {
		yield tick();	
	};
}

exports.softReset = function*() {
	yield resetCommunication();
	yield initTransmission();
	yield sendByte(CMD_SOFT_RESET);
}

exports.measure = function* (type) {
	console.log("Measure");
	function* waitForResults() {
		console.log("Wait for results");
		var val;
		while(val === 1) {
			//Wait until value of the data pin is 0
			yield wait(50);
			val = yield pinDAT.read();
		}
	}
	yield initTransmission();
	yield sendByte(type);
	yield waitForResults();
	var a = yield readByte({ack: true});
	var b = yield readByte({ack: false});
	var result = (a << 8) | b)
	console.log("meas: %j", [a,b]);
	return result; 
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
