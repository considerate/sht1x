var sht1x = require("./sht1x_lowlevel.js");
var co = require('co');

var tests = [{
	type: sht1x.MEAS_T,
 	convert: sht1x.convertToCelcius
},
{
	type: sht1x.MEAS_RH, 
	convert: sht1x.convertToRelativeHumidity
},
{
	type: sht1x.MEAS_RH, 
	convert: sht1x.convertToRelativeHumidity
},
{
	type: sht1x.MEAS_T, 
	convert: sht1x.convertToCelcius
}];

co(function* () {
	console.log("->Global.");
	yield sht1x.initPins(15, 18); 
	yield sht1x.resetCommunication()
	for(var i = 0; i < tests.length; i++) {
		var test = tests[i];
		var value = yield sht1x.measure(test.type);
		console.log("RES: %j", result);
		console.log("MEAS: " + test.convert(result));	
	}
	yield sht1x.destructPins();
	console.log("<-Global.");
})();
