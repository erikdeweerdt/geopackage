var sqlite3 = require('sqlite3').verbose();

var http = require('http');
var urlparser = require('url');

var xpath = require('xpath');
var DOMParser = require('xmldom').DOMParser;

var fs = require('fs');
var path = require('path');
var tmp = require('tmp');
var rmdir = require('rimraf');
var AdmZip = require('adm-zip');

var shapefile = require('shapefile');
var OpenLayers = require('openlayers').OpenLayers;

var GeoPackage = module.exports = function GeoPackage(type, features) {
  if (type === undefined)
    type = ':memory:';
  this.path = type;
  this.db = new sqlite3.Database(type);
  // this.db.on("trace", function(trace)
  // {
  //  console.log("TRACE: " + trace);
  // });
};

GeoPackage.prototype.geoJsonFeatureToWKT = function geoJsonFeatureToWKT(str) {
  var format = new OpenLayers.Format.GeoJSON();
  var geojson = format.read(str, 'Feature');
  var wkt_options = {};
  var wkt = new OpenLayers.Format.WKT(wkt_options);
  var out = wkt.write(geojson);
  return out;
};

GeoPackage.prototype.createOLGeoPackage = 
                  function createOLGeoPackage(features, name, srsName, cb) {
  var wktFormat = new OpenLayers.Format.WKT();
  var createdTable = false;
  
  // srs id 
  var srsId = parseInt(srsName.substring(srsName.lastIndexOf(":") + 1));
  if (srsId == NaN)
    srsId = -1;

  for (var i = 0; i < features.length; i++) {
    var values = [];
    var feature = features[i];
    var wkt = wktFormat.extractGeometry(feature.geometry);

    if (!createdTable) {
      var cols = [];
      var geomClassName = feature.geometry.CLASS_NAME;
      var geomType = geomClassName.substring(geomClassName.lastIndexOf('.') + 1);
      for (var col in feature.attributes)
        if (feature.attributes.hasOwnProperty(col))
          cols.push(col);
      this.createTable(name, cols, geomType, srsId, cb);
      createdTable = true;
    }

    for (var prop in feature.data)
      if (feature.data.hasOwnProperty(prop))
        values.push(escape(feature.data[prop]));

    values.push('st_geomfromtext("' + wkt + '")');
    this.insertRow(name, values, cb);
  }

  if (createdTable)
    this.finishTable(name, "features", geomType, srsId, cb);
  else
    cb('Table ' + name + ' not created');
};

GeoPackage.prototype.createTable = 
                                function createTable(name, cols, geomType, srsId, cb) {
  // create the table based on the feature properties
  var sql = 'CREATE TABLE ' + name + ' (';
  var db = this.db;

  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    // number, string, or boolean
    // map number to INTEGER, string to TEXT, boolean to INTEGER
    // TODO detect when number is a real
    var sqlType;
    switch(typeof col) {
      case 'string':
        sqlType = 'TEXT';
        break;
      case 'boolean':
      case 'number':
        sqlType = 'INTEGER';
        break;
      default:
        sqlType = 'TEXT';
    }
    sql = sql + ' ' + col + ' ' + sqlType + ',';
  }
  sql = sql.substring(0, sql.length - 1) + ' )';

  db.serialize(function() {
    db.run(sql, function(e) {
      if (e)
        cb(e);
    });
    createdTable = true;
    // for now don't worry about projections
    db.run('SELECT AddGeometryColumn("' + name + '", "geom", "' + geomType + '", ' + srsId + ', 0, 0)',
      function(e) {
        if (e)
          cb(e);
      });
  }); 
}

GeoPackage.prototype.insertRow = function insertRow(tableName, values, cb) {
  // db prepared statements are not running correctly here
  // so use a string and an insert
  var str = '';
  var db = this.db;

  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (i != (values.length -1))
      if ((typeof v) == 'string')
        v = '"' + v + '"';

    str = str + v + ',';
  }

  var sql = "INSERT INTO " + tableName + 
            " VALUES(" + str.substring(0, str.length - 1) + ")";

  db.serialize(function() { 
    db.run(sql, function(e){
      if (e)
        cb(e);
    });
  });
}

GeoPackage.prototype.finishTable = 
        function finishTable(tableName, dataType, geomType, srsId, cb)
{
  // update gpkg_contents tables
  var db = this.db;

  db.serialize(function() {
    var sql = 'SELECT ST_MinX(geom) as minx,  \
      ST_MinY(geom) as miny, \
      ST_MaxX(geom) as maxx, \
      ST_MaxY(geom) as maxy \
      FROM ' + tableName;
    db.get(sql, function(e, r) {
      if (e)
        cb(e)
      else {
        var sqlContents = 'INSERT INTO gpkg_contents ' +
          'VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

        db.run(sqlContents, tableName, dataType, tableName, "", 
                  new Date().toString(), r.minx, r.miny, r.maxx, r.maxy, srsId);
        cb(null, null);
      }
    });
  }); 
}

GeoPackage.prototype.dbLoad = function dbLoad(owcLink, cb) {
  var gpkg = this;
  var db = this.db;
  var type;
  var url;
  var typeName;
  var typeNamePrefix;
  var srsName = 'urn:x-ogc:def:crs:EPSG:4326';

  if (Array.isArray(owcLink)) {
    for (var i = 0; i < owcLink.length; i++) {
      // all we care about is getfeature and getmap
      var l = owcLink[i];
      switch(l.type.toLowerCase()) {
        case 'getfeature':
          url = l.link;
          type = 'wfs';
          // extract the typename for the filename
          var queryData = urlparser.parse(url, true).query;
          // change the queryData properties to lowercase
          for (var col in queryData.properties)
            if (queryData.properties.hasOwnProperty(col))
              queryData[col.toLowerCase()] = queryData[col];

          // short cut to get typename and NS
          var s = queryData.typename.split(':');
          typeNamePrefix = s[0];
          typeName = s[1];
          break;
        case 'getcapabilities':
          break;
        default:
          console.log('Unrecognised type: ' + l.type);
          cb(null);
      }

      if (typeName)
        break;
    }
  }
  else {
    type = owcLink.type;
    url = owcLink.link;
  }

  switch(type)
  {
    case 'application/x-shapefile':
      // special case not using OpenLayers parser
      // file is a zip file 
      var parts = urlparser.parse(url).pathname.split('/');

      tmp.dir(function _tempDirCreated(e, destPath) {
        if (e) cb(e);
        var fname = path.join(destPath, parts[parts.length - 1]);
        var file = fs.createWriteStream(fname);
        http.get(url, function(response) {
          response.pipe(file);
          file.on('finish', function() {
            file.close();
            var zip = new AdmZip(fname);
            zip.extractAllTo(destPath, true);
            var files = fs.readdirSync(destPath);
            var geomType;
            // process files into features and load into db
            // find shapefile and dbf file
            for (var i = 0; i < files.length; i++) {
              var shp = files[i];
              if (path.extname(shp) == '.shp')
              {
                var createdTable = false;
                typeName= path.basename(shp, '.shp')

                shapefile.readStream(path.join(destPath, shp))
                  .on('error', function(e) {cb(e)})
                  .on('header', function(header) {})
                  .on('feature', function(feature) { 
                    if (!createdTable)
                    {
                      // move properties into an array
                      var cols = [];
                      for (var col in feature.properties)
                        if (feature.properties.hasOwnProperty(col))
                          cols.push(col);

                      geomType = feature.geometry.type;

                      // support geojson names crs
                      if (feature.properties.crs && 
                            feature.properties.crs.properties.name)
                        srsName = feature.properties.crs.properties.name;

                      gpkg.createTable(typeName, cols, geomType, cb);
                      createdTable = true;
                    }

                    var geoStr = JSON.stringify(feature);
                    var wkt = gpkg.geoJsonFeatureToWKT(geoStr);
                    var values = [];

                    for (var prop in feature.properties)
                      if (feature.properties.hasOwnProperty(prop))
                        values.push(escape(feature.properties[prop]));

                    values.push('st_geomfromtext("' + wkt + '")');
                    gpkg.insertRow(typeName, values, cb);
                  })
                .on('end', function() {
                  rmdir(destPath, function(e){});
                  gpkg.finishTable(typeName, 'features', geomType, 
                    srsName, cb);
                  rmdir(destPath, function(e){});
                });
                break;
              }
            }
          });
        });
      });
      break;
    case 'wfs':
      // only support simple features profile in GML v3
      // get the feature type and namespace
      callback = function(response) {
        var str = '';
        response.on('data', function (chunk) {
          str += chunk;
        });

        response.on('end', function () {
          var doc = new DOMParser().parseFromString(str);  
          // find srs if set by using xpath
          var srs = xpath.select('//@srsName', doc);

          if (srs.length > 0)
            srsName = srs[0].value;

          var gmlFormat = new OpenLayers.Format.GML.v3({
              featureType: typeName,
              featureNS: doc.documentElement.lookupNamespaceURI(typeNamePrefix)
          });

          var features = gmlFormat.read(doc);
          gpkg.createOLGeoPackage(features, typeName, srsName, cb);
        });
      }

      http.request(url, callback).end();
      break;
    case 'application/rss+xml':
      callback = function(response) {
        var str = '';
        response.on('data', function (chunk) {
          str += chunk;
        });

        response.on('end', function () {
          var doc = new DOMParser().parseFromString(str);  
          // find srs if set by using xpath
          var srs = xpath.select('//@srsName', doc);

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
          gpkg.createOLGeoPackage(features, typeName, srsName, cb);
        });
      }
      var typeName = url.substring(url.lastIndexOf("/") + 1);
      if (typeName.indexOf('.') != -1)
        typeName = typeName.substring(0, typeName.indexOf('.'));

      http.request(url, callback).end();
      break;
    default:
      console.log('Unrecognised type: ' + type);
      cb('Unrecognised type: ' + type);
  }
};

GeoPackage.prototype.load = function load(ctx, entries, cb)
{
  // load extension and initialize geopackage
  var db = this.db;
  var gpkg = this;

  this.db.loadExtension('/usr/local/lib/libgpkg.sqlext', function(e) {
    if (e)
      cb(e)
    else
    {
      var results = [];

      // init geopackage
      db.run('SELECT InitSpatialMetadata()', function(e) {
        if (e)
        {
          error(e);
        }
        else
        {
          // for now everything is a straight http(s) download and
          // we use type to process it
          entries.forEach(function(f) {
            var entryCb = function(e, val)
            {
              if (e)
                cb(e)
              else
              {
                results.push(val);

                if (results.length == entries.length)
                {
                  // insert ctx document
                  var sqlMetadata = 'INSERT INTO gpkg_metadata \
                    VALUES(?, ?, ?, ?, ?)';
                  db.run(sqlMetadata, 1, 'undefined', 
                    'http://www.opengis.net/owc/1.0', 'application/rss+xml', 
                    ctx.toString());

                  // close db and stream to the caller
                  db.close(function(e)
                    {
                      if (e)
                        cb(e);
                      else
                        cb(null, 1);
                    });
                  }
                }
            };
            gpkg.dbLoad(f.owcLink, entryCb);
          });
          }
        });
    }
  });
}
