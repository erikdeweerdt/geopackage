var sqlite3 = require("sqlite3").verbose();

var http = require("http");
var urlparser = require("url");

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

GeoPackage.prototype.dbLoad = function dbLoad(db, gpkg, url, destPath, type, err, cb)
{
	var parts = urlparser.parse(url).pathname.split("/");
	var fname = path.join(destPath, parts[parts.length - 1]);
	var file = fs.createWriteStream(fname);
	var request = http.get(url, function(response) {
		response.pipe(file);
		file.on("finish", function() {
			file.close();
			switch(type)
			{
				case "application/x-shapefile":
					// file is a zip file 
					var zip = new AdmZip(fname);
					zip.extractAllTo(destPath, true);
					// process files into features and load into db
					var files = fs.readdirSync(destPath);

					// find shapefile and dbf file
					for (var i = 0; i < files.length; i++)
					{
						var shp = files[i];
						if (path.extname(shp) == ".shp")
						{
							var createdTable = false;
							var layer = path.basename(shp, '.shp')
							var stmt;

							shapefile.readStream(path.join(destPath, shp))
								.on("error", err)
								.on("header", function(header) {})
								.on("feature", function(feature) { 
									if (!createdTable)
									{
										// create the table based on the feature properties
										var sql = "CREATE TABLE " + layer + " (";

										// { type: 'Feature',
										//   properties: { FID: '101', NAME: 'Blue Lake' },
										//   geometry: { type: 'Polygon', coordinates: [ [Object], [Object] ] } }

										var stmtStr = "INSERT INTO " + layer + " VALUES (";	
										for (var col in feature.properties) {
  											if (feature.properties.hasOwnProperty(col)) {
												// number, string, or boolean
												// map number to INTEGER, string to TEXT, boolean to INTEGER
												// TODO detect when number is a real
												var sqlType;

												switch(typeof feature.properties[col])
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
												stmtStr = stmtStr + " ?,";
												sql = sql + " " + col + " " + sqlType + ",";
											}
										}

										sql = sql.substring(0, sql.length - 1) + " )";
										// stmtStr = stmtStr.substring(0, stmtStr.length - 1) + " )";
										// add geom parameter
										stmtStr = stmtStr + " ?)";

										db.serialize(function() {
											db.run(sql);
											createdTable = true;
											// for now don't worry about projections
											db.run("SELECT AddGeometryColumn('" + layer + "', 'geom', '" + feature.geometry.type + "', 0, 0, 0)");
											stmt = db.prepare(stmtStr);
										});
									}

									// fix statement object so we can call apply
									stmt.myrun = function(values)
									{
										stmt.run(values);
									}

									var geoStr = JSON.stringify(feature);
									var wkt = gpkg.geoJsonFeatureToWKT(geoStr);
									var values = [];

									for (var prop in feature.properties)
										values.push(feature.properties[prop]);

									values.push("st_geomfromtext('" + wkt + "'')");

									stmt.myrun.apply(null, values);
								})
								.on("error", err)
								.on("end", function() {
									cb(null);
									stmt.finalize();
									rmdir(destPath, function(e){});
								});
							break;
						}
					}

					break;
				default:
					cb(null);
					console.log("Unrecognised type: " + type);
			}
			
		});
	});
};

GeoPackage.prototype.load = function load(features, error, res)
{
	// load extension and initialize geopackage
	var db = this.db;
	var dbLoad = this.dbLoad;
	var gpkg = this;

	this.db.loadExtension("/usr/local/lib/libgpkg.sqlext", function(e)
	{
		if (e)
			error(err)
		else
		{
			var results = [];

			// init geopackage
			db.run("SELECT InitSpatialMetadata()");

			// for now everything is a straight http(s) download and
			// we use type to process it
			features.forEach(function(f) {
				var link = f.owcLink.link;
				var type = f.owcLink.type;

				var cb = function(val)
				{
					results.push(val);

					if (results.length == features.length)
					{
						// close db and stream to the caller
						db.close();
						res(1);
					}
				};
			
				tmp.dir(function _tempDirCreated(e, dirpath) {
					if (e) err(e);
					dbLoad(db, gpkg, link, dirpath, type, function(e){ error(e);}, cb);
				});
			});
		}
	});
}