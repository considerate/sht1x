var sht1x = require("..");

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

sht1x.create(function* (sensor) {
	console.log('First test');
	yield sensor.init({
		dataPin: 15, 
		clockPin: 18
	}); 
	for(var i = 0; i < tests.length; i++) {
		var test = tests[i];
		var value = yield sensor.measure(test.type);
		console.log("Data: %d", value);
		console.log("%s: %d", test.label, test.convert(value));	
	}
	yield sensor.close();
}, function() {
	console.log('Second test');
	sht1x.create(function* (sensor) {
		yield sensor.init({
			dataPin: 15, 
			clockPin: 18
		}); 
		for(var i = 0; i < tests.length; i++) {
			var test = tests[i];
			var value = yield sensor.measure(test.type);
			console.log("Data: %d", value);
			console.log("%s: %d", test.label, test.convert(value));	
		}
		yield sensor.close();
	});
});


