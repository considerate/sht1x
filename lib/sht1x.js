var Pin = require('./pin');
var wait = require('co-wait');
var co = require('co');

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

function b2d(val) { 
	return parseInt(val, 2); 
}

// Available commands.
var CMD_MEAS_T   = b2d("00011");
var CMD_MEAS_RH  = b2d("00101");
var CMD_STATUS_R = b2d("00111");
var CMD_STATUS_W = b2d("00110");
var CMD_RESET    = b2d("11110");

// Local copy of sensors status register. It defaults to 0.
var statusReg = 0;

// Expose two types of measurements.
exports.TEMPERATURE = CMD_MEAS_T;
exports.HUMIDITY = CMD_MEAS_RH;

// Expose bit location of settings in status register.
exports.STATUS_HEATING      	= b2d("00000100"); 
exports.STATUS_NO_OTP_RELOAD  	= b2d("00000010"); 
exports.STATUS_LOW_PRECISION    = b2d("00000001");
exports.STATUS_ENDOFBATTERY 	= b2d("01000000");


function* tick() {
	yield this.clockPin.write(1);
	yield this.clockPin.write(0);
}
var reverseByte = (function initReverseByte() {
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
	};
})();

/**
 * CLK: __/^^^\___/^^^\__ 
 * DAT: ^^^^\_______/^^^^ 
 */
function* initTransmission(callback) {
	yield this.dataPin.write(1);
	yield this.clockPin.write(0);
	yield this.clockPin.write(1);
	yield this.dataPin.write(0);
	yield this.clockPin.write(0);
	yield this.clockPin.write(1);
	yield this.dataPin.write(1);
	yield this.clockPin.write(0);	
}

function* readByte(options) {
	var ack = options.ack;
	var reads = [];
	for(var i = 0; i < 8; i++) {
		var val = yield this.dataPin.read(); 
		yield tick.call(this);
		reads.push(val);
	}
	var bits = reads.join(''); //Concat all read bits (empty string join)
	var value = b2d(bits);
	if(ack) {
		yield ACKReadByte.call(this);	
	}
	return value;
}

function* sendByte(val) {
	for(var i = 0; i < 8; i ++) {
		//Write bit i of val to this.dataPin
		var bit = (val >> (7 - i)) & 1;
		yield this.dataPin.write(bit);	
		yield tick.call(this);	
	}
	yield ACKSentByte.call(this);
}

function* ACKReadByte() {
	yield this.dataPin.write(0);
	yield tick.call(this);
}

function* ACKSentByte() {
	var a = yield this.dataPin.read();
	yield tick.call(this);
	var b = yield this.dataPin.read();
	if(a === 0 && b === 1) {
		return;
	} else {
		throw Error("Got no ACK on sent byte.");
	}
}

exports.create = function(fn, done) {
	var context = {};
	context.init = initPins;
	context.close = closePins;
	context.reset = resetCommunication;
	context.softReset = softReset;
	context.measure = measure;
	var generator = co(fn);
	generator(context, done);
};

function* initPins(options) {
	var dataPin = new Pin(options.dataPin, 1, Pin.OUTPUT);
	var clockPin = new Pin(options.clockPin, 0, Pin.OUTPUT);
	this.dataPin = dataPin;
	this.clockPin = clockPin;
	yield dataPin.init();
	yield clockPin.init();
}

function* closePins() {
	yield this.dataPin.close();
	yield this.clockPin.close();
}

function* resetCommunication() {
	yield this.dataPin.write(1);
	for(var i = 0; i < 9; i++) {
		yield tick.call(this);	
	}
}

function* softReset() {
	yield resetCommunication.call(this);
	yield initTransmission.call(this);
	yield sendByte.call(this, CMD_SOFT_RESET);
}

function* waitForResults() {
	var val = 1;
	while(val === 1) {
		//Wait until value of the data pin is 0
		yield wait(10);
		val = yield this.dataPin.read();
	}
}

function* measure(type) {
	yield initTransmission.call(this);
	yield sendByte.call(this, type);
	yield waitForResults.call(this);
	var a = yield readByte.call(this, {ack: true});
	var b = yield readByte.call(this, {ack: false});
	var result = (a << 8) | b;
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
};

exports.convertToRelativeHumidity = function(val) {
	if(statusReg & exports.STATUS_LOW_PRECISION) {
		return CONVERSION_C1_LOWP + CONVERSION_C2_LOWP * val + CONVERSION_C3_LOWP * val * val;
	} else {
		return CONVERSION_C1_HIGHP + CONVERSION_C2_HIGHP * val + CONVERSION_C3_HIGHP * val * val;
	}
};
