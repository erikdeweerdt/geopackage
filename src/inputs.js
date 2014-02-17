{ 
	"identification": { 
		"title": "GeoPackage WPS", 
		"abstract": "Cloudant GeoPackaging WPS server for OWS10",
		"keywords": ["WPS", "OWS10", "GeoPackage"],
		"type": "WPS",
		"versions": ["1.0.0"],
		"fees" : "NONE",
		"accessConstraints": "NONE"
	},
	"provider": {
		"name": "Cloudant",
		"site" : "http://www.cloudant.com",
		"contact": {
			"voice" : "(857) 400-9900",
			"deliveryPoint": "129 South St",
			"city": "Boston",
			"adminArea": "MA",
			"postalCode": "02111",
			"country": "USA",
			"email": "norman@cloudant.com"
		}
	},
	"operations": [
	    {
		    "name": "getCapabilities",
			"get": "http://localhost:1337/wps?"
		},
		{
		    "name": "describeProcess",
			"get" : "http://localhost:1337/wps?"
		},
		{
		    "name": "execute",
			"post": "http://localhost:1337/wps"
		}
	],
	"processes" :[
	{
		"version": 1,
		"id": "geopackage",
		"title": "GeoPackaging Service",
		"abstract" : "GeoPackaging processing service",
		"metadata" : ["geopackage", "wps"],
		"profile" : "urn:ogc:wps:1.0.0:geopackage",
		"inputs" : [
		    {
		    	"id" : "OWSContext",
		    	"title" : "OWS Context Document used to specifiy geopackage",
		    	"abstract" : "Body of request is the OWS Context document",
		    	"minOccurs": 1,
		    	"maxOccurs": 1,
		    	"maxSize": 5,
		    	"defaultFormat": {
		    		"mimeType": "text/xml",
		    		"encoding": "UTF-8",
		    		"schema": "http://schemas.opengis.net/context/1.1.0/context.xsd"
		    	},
		    	"supportedFormats": [
		    		{
		    			"mimeType": "text/xml",
		    			"encoding": "base64",
		    			"schema": "http://schemas.opengis.net/context/1.1.0/context.xsd"
		    		}
		    	]
		    }
		],
		"outputs" : [
			{
				"id": "geopackage",
				"title" : "geopackage",
				"abstract" : "geopackage representing input owscontext document",
				"defaultFormat": {
					"mimeType" : "application/vnd.ogc.gpkg",
					"encoding" : "binary",
					"schema" : ""
				},
				"supportedFormats": []
			}
		]
	}],
	"languages" : {
		"default" : "en"
	}
}
