var jade = require('jade');
var fs = require('fs');

var capTemplate = jade.compile(fs.readFileSync('src/wpsCapabilities.jade', 'utf8'));
var descTemplate = jade.compile(fs.readFileSync('src/wpsDescribeProcess.jade', 'utf8'));
var errorTemplate = jade.compile(fs.readFileSync('src/wpsError.jade', 'utf8'));
var owsParams = JSON.parse(fs.readFileSync('src/inputs.js', 'utf8'));

exports.getCapabilities = function () {
	return capTemplate(owsParams);
};

exports.describeProcess = function () {
	return descTemplate(owsParams);
}

exports.getError = function(errMsg) {
	return errorTemplate(errMsg);
}

exports.check_req_param = function(ex, q, v)
{
	if (!q)
		ex.push({
	        exceptionCode: "MissingParameterValue",
	        locator: v.type
	});

	if (q && (v.values.indexOf(q.toLowerCase()) == -1))
		ex.push({
	        exceptionCode: "InvalidParameterValue",
	        locator: v.type
	});
}

exports.execute = function(ctx) {

}
