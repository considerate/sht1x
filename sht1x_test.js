var sht1x = require("./sht1x");
var co = require('co');

var tests = [{
	label: 'Temperature',
	type: sht1x.TEMPERATURE,
 	convert: sht1x.convertToCelcius
},
{
	label: 'Humidity (%)',
	type: sht1x.HUMIDITY, 
	convert: sht1x.convertToRelativeHumidity
}];

co(function* () {
	var sensor = sht1x.create();
	yield sensor.init({
		dataPin: 15, 
		clockPin: 18
	}); 
	//yield sensor.reset();
	for(var i = 0; i < tests.length; i++) {
		var test = tests[i];
		var value = yield sensor.measure(test.type);
		console.log("Data: %d", value);
		console.log("%s: %d", test.label, test.convert(value));	
	}
	yield sensor.close();
})();
