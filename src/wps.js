var jade = require('jade');
var fs = require('fs');
var DOMParser = require('xmldom').DOMParser;
var OpenLayers = require('openlayers').OpenLayers;
var GeoPackage = require('../src/GeoPackage');
var tmp = require('tmp');

var capTemplate = jade.compile(fs.readFileSync('src/wpsCapabilities.jade', 'utf8'));
var descTemplate = jade.compile(fs.readFileSync('src/wpsDescribeProcess.jade', 'utf8'));
var errorTemplate = jade.compile(fs.readFileSync('src/wpsError.jade', 'utf8'));
var owsParams = JSON.parse(fs.readFileSync('src/inputs.js', 'utf8'));
var wpsNS = 'http://www.opengis.net/wps/1.0.0';

module.exports = {
  getCapabilities : function () {
    return capTemplate(owsParams);
  },

  describeProcess : function () {
    return descTemplate(owsParams);
  },

  getError : function(errMsg) {
    return errorTemplate(errMsg);
  },

  checkReqParam : function(ex, q, v) {
    if (!q)
      ex.push({
            exceptionCode: 'MissingParameterValue',
            locator: v.type
    });

    if (q && (v.values.indexOf(q.toLowerCase()) == -1))
      ex.push({
            exceptionCode: 'InvalidParameterValue',
            locator: v.type
    });
  },

  parseReqBody : function(ex, xml) {
    var domParser = new DOMParser();
    var xmlFormat = new OpenLayers.Format.XML();
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    var resp = null;
    
    // extract the RSS Context by jumping to the complex data in the put section
    var rss = xmlFormat.getElementsByTagNameNS(doc, wpsNS, 'ComplexData');
    if ((rss.length == 1) && (rss.item(0).hasChildNodes())) {
      var child = rss.item(0).firstChild;
      while (child) {
        if (child.nodeType == 4) {
          //cdata
          var rssDoc = new DOMParser().parseFromString(child.nodeValue);
          var rssFormat = new OpenLayers.Format.GeoRSS({
            // don't care about namespaces for now
            // TODO this is a 'feature' in XMLDom and OpenLayers GeoRSS parser
            getElementsByTagNameNS : function(node, uri, name)
            {
              return  node.getElementsByTagName(name);
            },
            createFeatureFromItem : function(item) {
              var entry = 
                OpenLayers.Format.GeoRSS.prototype.createFeatureFromItem.apply(
                  this, arguments);

              // get owc:offering/owc:content
              var child = item.firstChild;
              while (child) {
                if (child.localName == 'offering') {
                  var c2 = child.firstChild;
                  while (c2) {
                    if (c2.localName == 'content'){
                      entry.owcLink = {
                        "link" : c2.getAttribute('href'),
                        "type" : c2.getAttribute('type')
                      };
                      break;
                    }
                    else if (c2.localName == 'operation') {
                      // wfs / wms
                      var obj = {
                        "link" : c2.getAttribute('href'),
                        "type" : c2.getAttribute('code'),
                        "method" : c2.getAttribute('method')
                      };

                      if (entry.owcLink)
                        entry.owcLink.push(obj);
                      else
                        entry.owcLink = [obj];
                    }
                    c2 = c2.nextSibling;
                  }
                  break;
                }
                child = child.nextSibling;
              }
              return entry;
            }
          });

          resp = {ctx: rssDoc, entries: rssFormat.read(rssDoc)}
          break;
        }
        child = child.nextSibling;
      }
    }

    if (resp == null)
    {
      ex.push({
        exceptionCode: 'NoApplicableCode'
      });
    }
    return resp;
  },

  execute : function(ctx, entries, cb) {
    tmp.tmpName({postfix: '.db'}, function _tempNameGenerated(e, path) {
      if (e) 
        cb(e);

      var gpkg= new GeoPackage(path);;
      gpkg.load(ctx, entries, 
        function(e, result)
        {
          if (e)
            cb(e);
          else 
            cb(null, path);
        });
    });
  }
};


