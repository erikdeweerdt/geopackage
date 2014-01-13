var express = require("express");
var wps =  require("./src/wps");
var app = express();

app.use(function(req, res, next) {
    var data='';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { 
       data += chunk;
    });

    req.on('end', function() {
        req.body = data;
        next();
    });
});
app.use(function(err, request, response, next){
  console.error(err.stack);
  response.send(500, wps.getError({
  	exceptions: [{
  		exceptionCode: "NoApplicableCode"
  	}]
  }));
});

app.use(app.router);

app.get('/wps', function(request, response) {
	var q = request.query.request;
	var version = request.query.version;
	var service = request.query.service;
	var ex = [];

	wps.checkReqParam(ex, q, {type: "request", values : ["getcapabilities", "describeprocess"]});
	wps.checkReqParam(ex, service, {type: "service", values : ["wps"]});
	wps.checkReqParam(ex, version, {type: "version", values: ["1.0.0"]});

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
   var ex = [];
   var features = wps.parseReqBody(ex, body);
   console.log(JSON.stringify(features));
   if (ex.length == 0)
   {
		// not implemented yet
 		response.send(500, wps.getError({
  			exceptions: [{
  				exceptionCode: "NoApplicableCode"
  		}]
  		}));
  	}
  	else
  	{
  		response.contentType("xml");
		response.send(400, wps.getError({
	      exceptions: ex
	    }));
  	}
});

app.listen(1337);
console.log("Listening on port 1337");