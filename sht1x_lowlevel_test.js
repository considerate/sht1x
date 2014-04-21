var sht1x = require("./sht1x_lowlevel.js");
var async = require("./HallUt14/client/node_modules/async");

console.log("->Global.");
async.series([
	function(next) { sht1x.initPins(15, 18, next); },	
	sht1x.resetCommunication,
	function(next) { sht1x.measure(sht1x.MEAS_T, function(err, result) {
		if(!err) {
			console.log("RES: %j", result);
			console.log("MEAS: " + sht1x.convertToCelcius(result));
		}
		next(err);
	}); },
	function(next) { sht1x.measure(sht1x.MEAS_RH, function(err, result) {
		if(!err) {
			console.log("RES: %j", result);
			console.log("MEAS: " + sht1x.convertToRelativeHumidity(result));
		}
		next(err);
	}); },
	function(next) { sht1x.measure(sht1x.MEAS_RH, function(err, result) {
		if(!err) {
			console.log("RES: %j", result);
			console.log("MEAS: " + sht1x.convertToRelativeHumidity(result));
		}
		next(err);
	}); },
	function(next) { sht1x.measure(sht1x.MEAS_T, function(err, result) {
		if(!err) {
			console.log("RES: %j", result);
			console.log("MEAS: " + sht1x.convertToCelcius(result));
		}
		next(err);
	}); },
], function(err, results) {
	if(err) {
		console.log("ERR: %j", err);
	}
	sht1x.destructPins(function(err) {
		if(err) {
			console.log("ERR CLOSING: %j", err);
		} else {
			console.log("Closed pins.");
		}
	});
});
console.log("<-Global.");



// async.series([
// 	function(next) { sht1x.openPins(15, 18, next); },
// 	function(next) { sht1x.resetConnection(next); },
// 	// function(next) { sht1x.makeMeasurement(sht1x.MEASURE_TEMPERATURE, function(err, result) {
// 	// 	if(!err) {
// 	// 		console.log("Temperature: " + sht1x.convertToCelcius(result) + "*C");
// 	// 	}
// 	// 	next(err);
// 	// }); },
// 	// function(next) { sht1x.makeMeasurement(sht1x.MEASURE_RELHUMIDITY, function(err, result) {
// 	// 	if(!err) {
// 	// 		console.log("Humidity: " + sht1x.convertToRelativeHumidity(result) + "%");
// 	// 	}
// 	// 	next(err);
// 	// }); },
// 	function(next) { sht1x.readStatus(function(err, result) {
// 		if(!err) {
// 			console.log("Status: " + result);
// 		}
// 		next(err);
// 	}); },
// ], function(err, results) {
// 	if(err) {
// 		console.log("Error somewhere: %j", err);
// 	}
// 	sht1x.closePins(function(err) {
// 		if(err) {
// 			console.log("Error closing pins: %j", err);
// 		} else {
// 			console.log("Closed pins.");
// 		}
// 	});
// });
