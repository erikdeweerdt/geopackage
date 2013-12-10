var express = require('express');
var wps =  require('./src/wps.js');
var app = express();

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(function(err, request, response, next){
  console.error(err.stack);
  response.send(500, wps.getError({
  	exceptions: [{
  		exceptionCode: "NoApplicableCode"
  	}]
  }));
});

app.get('/wps', function(request, response) {
	var q = request.query.request;
	var version = request.query.version;
	var service = request.query.service;
	var ex = [];

	wps.check_req_param(ex, q, {type: "request", values : ["getcapabilities", "describeprocess"]});
	wps.check_req_param(ex, service, {type: "service", values : ["wps"]});
	wps.check_req_param(ex, version, {type: "version", values: ["1.0.0"]});

	if (ex.length == 0)
	{
		switch(q.toLowerCase()) 
		{
			case "getcapabilities":
				response.contentType("xml");
  				response.send(wps.getCapabilities());
				break;
			case "describeprocess":
				response.contentType("xml");
  				response.send(wps.describeProcess());
				break;
			default:
				response.contentType("xml");
				response.send(400, wps.getError({
			      exceptions: [{
			        exceptionCode: "InvalidParameterValue",
			        locator: q
			      }]
			    }));
				break;
		}
	}
	else
	{
		response.contentType("xml");
		response.send(400, wps.getError({
	      exceptions: ex
	    }));
	}
});

app.post('/wps', function(request, response) {
   var body = request.body;
   console.log(body);
   // not implemented yet
   response.send(500, wps.getError({
  	exceptions: [{
  		exceptionCode: "NoApplicableCode"
  	}]
  }));
});

app.listen(1337);
console.log("Listening on port 1337");