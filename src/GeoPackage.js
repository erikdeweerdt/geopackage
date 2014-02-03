var sqlite3 = require("sqlite3").verbose();

var http = require("http");
var urlparser = require("url");

var xpath = require('xpath');
var DOMParser = require("xmldom").DOMParser;

var fs = require("fs");
var path = require("path");
var tmp = require("tmp");
var rmdir = require("rimraf");
var AdmZip = require('adm-zip');

var shapefile = require("shapefile");
var OpenLayers = require("openlayers").OpenLayers;

var GeoPackage = module.exports = function GeoPackage(type, features) {
	if (type === undefined)
		type = ":memory:";
	this.path = type;
	this.db = new sqlite3.Database(type);
	// this.db.on("trace", function(trace)
	// {
	// 	console.log("TRACE: " + trace);
	// });
};

GeoPackage.prototype.geoJsonFeatureToWKT = function geoJsonFeatureToWKT(str) 
{
	var format = new OpenLayers.Format.GeoJSON();
	var geojson = format.read(str, "Feature");

	var wkt_options = {};
	var wkt = new OpenLayers.Format.WKT(wkt_options);
	var out = wkt.write(geojson);
	return out;
};

GeoPackage.prototype.createOLGeoPackage = function createOLGeoPackage(features, name, srsName, err, cb)
{
	var wktFormat = new OpenLayers.Format.WKT();
	var createdTable = false;

	for (var i = 0; i < features.length; i++)
	{
		var values = [];
		var feature = features[i];
		var wkt = wktFormat.extractGeometry(feature.geometry);

		if (!createdTable)
		{
			var cols = [];
			var geomClassName = feature.geometry.CLASS_NAME;
			var geomType = geomClassName.substring(geomClassName.lastIndexOf(".") + 1);
			for (var col in feature.attributes)
				if (feature.attributes.hasOwnProperty(col))
					cols.push(col);
			this.createTable(name, cols, geomType, err);
			createdTable = true;
		}

		for (var prop in feature.data)
			if (feature.data.hasOwnProperty(prop))
				values.push(escape(feature.data[prop]));

		values.push("st_geomfromtext('" + wkt + "')");
		this.insertRow(name, values, err);
	}

	if (createdTable)
		this.finishTable(name, "features", geomType, srsName, err, cb);
	else
		err("Table " + name + " not created");
};

GeoPackage.prototype.createTable = function createTable(name, cols, geomType, err)
{
	// create the table based on the feature properties
	var sql = "CREATE TABLE " + name + " (";
	var db = this.db;

	for (var i = 0; i < cols.length; i++) {
		var col = cols[i];
		// number, string, or boolean
		// map number to INTEGER, string to TEXT, boolean to INTEGER
		// TODO detect when number is a real
		var sqlType;
		switch(typeof col)
		{
			case "string":
				sqlType = "STRING";
				break;
			case "boolean":
			case "number":
				sqlType = "INTEGER";
				break;
			default:
				sqlType = "STRING";
		}
		sql = sql + " " + col + " " + sqlType + ",";
	}
	sql = sql.substring(0, sql.length - 1) + " )";

	db.serialize(function() {
		db.run(sql);
		createdTable = true;
		// for now don't worry about projections
		db.run("SELECT AddGeometryColumn('" + name + "', 'geom', '" + geomType + "', 0, 0, 0)");
	});	
}

GeoPackage.prototype.insertRow = function insertRow(tableName, values, err)
{
	// db prepared statements are not running correctly here so use a string and an insert
	var str = "";
	var db = this.db;

	for (var i = 0; i < values.length; i++)
	{
		var v = values[i];
		if (i != (values.length -1))
			if ((typeof v) == "string")
				v = "'" + v + "'";

		str = str + v + ",";
	}

	var sql = "INSERT INTO " + tableName + " VALUES(" + str.substring(0, str.length - 1) + ")";

	db.serialize(function() { 
		db.run(sql);
	});
}

GeoPackage.prototype.finishTable = function finishTable(tableName, dataType, geomType, srsName, err, cb)
{
	// update gpkg_contents tables
	var db = this.db;

	db.serialize(function() {
		var sql = "SELECT ST_MinX(geom) as minx,  \
			ST_MinY(geom) as miny, \
			ST_MaxX(geom) as maxx, \
			ST_MaxY(geom) as maxy \
			FROM " + tableName;
		db.get(sql, function(e, r)
		{
			if (e)
				err(e)
			else
			{
				var sqlContents = "INSERT INTO gpkg_contents VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
				// srs id 
				var srsId = parseInt(srsName.substring(srsName.lastIndexOf(":") + 1));
				if (srsId == NaN)
					srsId = -1;

				db.run(sqlContents, tableName, dataType, tableName, "", new Date().toString(), r.minx, r.miny, r.maxx, r.maxy, srsId);
				cb(null);
			}
		});
		


	}); 
}

GeoPackage.prototype.dbLoad = function dbLoad(owcLink, destPath, err, cb)
{
	var gpkg = this;
	var db = this.db;
	var type, url, fname, file;
	var typeName, typeNamePrefix;
	var srsName = "urn:x-ogc:def:crs:EPSG:4326";

	if (Array.isArray(owcLink))
	{
		for (var i = 0; i < owcLink.length; i++)
		{
			// all we care about is getfeature and getmap
			var l = owcLink[i];
			switch(l.type.toLowerCase())
			{
				case "getfeature":
					url = l.link;
					type = "wfs";
					// extract the typename for the filename
					var queryData = urlparser.parse(url, true).query;
					// change the queryData properties to lowercase
					for (var col in queryData.properties)
						if (queryData.properties.hasOwnProperty(col))
							queryData[col.toLowerCase()] = queryData[col];

					// short cut to get typename and NS
					var tmp = queryData.typename.split(":");
					typeNamePrefix = tmp[0];
					typeName = tmp[1];
					fname = path.join(destPath, typeName + ".gml")
					break;
				case "getcapabilities":
					break;
				default:
					console.log("Unrecognised type: " + l.type);
					cb(null);
			}

			if (fname)
				break;
		}
	}
	else
	{
		type = owcLink.type;
		url = owcLink.link;
		var parts = urlparser.parse(url).pathname.split("/");
		fname = path.join(destPath, parts[parts.length - 1]);
	}

	var createTable = function(name, cols, geomType, err)
	{
		gpkg.createTable(name, cols, geomType, err);
	};

	var insertRow = function(layer, values, err)
	{
		gpkg.insertRow(layer, values, err);
	};

	if (fname)
	{
		file = fs.createWriteStream(fname);

		var request = http.get(url, function(response) {
			response.pipe(file);
			file.on("finish", function() {
				file.close();
				switch(type)
				{
					case "application/x-shapefile":
						// special case not using OpenLayers parser
						// file is a zip file 
						var zip = new AdmZip(fname);
						zip.extractAllTo(destPath, true);
						// process files into features and load into db
						var files = fs.readdirSync(destPath);
						var geomType;

						// find shapefile and dbf file
						for (var i = 0; i < files.length; i++)
						{
							var shp = files[i];
							if (path.extname(shp) == ".shp")
							{
								var createdTable = false;
								typeName= path.basename(shp, '.shp')
								var stmt;

								shapefile.readStream(path.join(destPath, shp))
									.on("error", err)
									.on("header", function(header) {})
									.on("feature", function(feature) { 
										if (!createdTable)
										{
											// move properties into an array
											var cols = [];
											for (var col in feature.properties)
												if (feature.properties.hasOwnProperty(col))
													cols.push(col);

											geomType = feature.geometry.type;

											// support geojson names crs
											if (feature.properties.crs && feature.properties.crs.properties.name)
												srsName = feature.properties.crs.properties.name;

											gpkg.createTable(typeName, cols, geomType, err);
											createdTable = true;
										}

										var geoStr = JSON.stringify(feature);
										var wkt = gpkg.geoJsonFeatureToWKT(geoStr);
										var values = [];

										for (var prop in feature.properties)
											if (feature.properties.hasOwnProperty(prop))
												values.push(escape(feature.properties[prop]));

										values.push("st_geomfromtext('" + wkt + "')");
										gpkg.insertRow(typeName, values, err);
									})
									.on("error", err)
									.on("end", function() {
										rmdir(destPath, function(e){});
										gpkg.finishTable(typeName, "features", geomType, srsName, err, cb)
									});
								break;
							}
						}
						break;
					case "wfs":
						// only support simple features profile in GML v3
						// get the feature type and namespace
						var doc = new DOMParser().parseFromString(fs.readFileSync(fname, "utf8"));	

						// find srs if set by using xpath
						var srs = xpath.select("//@srsName", doc);

						if (srs.length > 0)
							srsName = srs[0].value;

						var gmlFormat = new OpenLayers.Format.GML.v3(
							{
								featureType: typeName,
								featureNS: doc.documentElement.lookupNamespaceURI(typeNamePrefix)
							}
						);

						var features = gmlFormat.read(doc);
						gpkg.createOLGeoPackage(features, typeName, srsName, err, cb);
						rmdir(destPath, function(e){});
						break;
					case "application/rss+xml":
						var doc = new DOMParser().parseFromString(fs.readFileSync(fname, "utf8"));	

						// find srs if set by using xpath
						var srs = xpath.select("//@srsName", doc);

						if (srs.length > 0)
							srsName = srs[0].value;

						var rssFormat = new OpenLayers.Format.GeoRSS({
							// don't care about namespaces except georss for now
							// TODO this is a 'feature' in XMLDom and OpenLayers GeoRSS parser
							getElementsByTagNameNS : function(node, uri, name)
							{
								if ((uri == this.georssns) ||(uri == this.geons))
									return node.getElementsByTagNameNS(uri, name);
								else
									return node.getElementsByTagName(name);
							}
						});
						var features = rssFormat.read(doc);
						typeName = path.basename(fname);
						if (typeName.indexOf(".") != -1)
							typeName = typeName.substring(0, typeName.indexOf("."));

						gpkg.createOLGeoPackage(features, typeName, srsName, err, cb);
						rmdir(destPath, function(e){});
						break;

					default:
						console.log("Unrecognised type: " + type);
						err("Unrecognised type: " + type);
				}				
			});
		});
	}
	else
	{
		console.log("Unable to create output file");
		err("Unable to create output file");
	}
};

GeoPackage.prototype.load = function load(ctx, entries, error, res)
{
	// load extension and initialize geopackage
	var db = this.db;
	var gpkg = this;
	var dbLoad = function(link, dirpath, type, error, cb) 
	{
		gpkg.dbLoad(link, dirpath, type, error, cb);
	};

	this.db.loadExtension("/usr/local/lib/libgpkg.sqlext", function(e)
	{
		if (e)
			error(err)
		else
		{
			var results = [];

			// init geopackage
			db.run("SELECT InitSpatialMetadata()", function(e)
				{
					if (e)
					{
						error(e);
					}
					else
					{
						// for now everything is a straight http(s) download and
						// we use type to process it
						entries.forEach(function(f) {
							var cb = function(val)
							{
								results.push(val);

								if (results.length == entries.length)
								{
									// insert ctx document
									var sqlMetadata = "INSERT INTO gpkg_metadata VALUES(?, ?, ?, ?, ?)";
									db.run(sqlMetadata, 1, "undefined", "http://www.opengis.net/owc/1.0", "application/rss+xml", ctx.toString());

									// close db and stream to the caller
									db.close(function(e)
										{
											if (e)
												error(e);
											else
												res(1);
										});
								}
							};
						
							tmp.dir(function _tempDirCreated(e, dirpath) {
								if (e) error(e);
								dbLoad(f.owcLink, dirpath, function(e){ error(e);}, cb);
							});
						});
					}
				});
		}
	});
}