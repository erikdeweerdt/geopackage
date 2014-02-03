"use strict";

var wps = require("../src/wps.js");
var fs = require("fs");
var OpenLayers = require('openlayers').OpenLayers;

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

module.exports = {
  setUp: function(callback) {
    // setup here
    callback();
  },
  tearDown: function (callback) {
    // clean up
    callback();
  },
  testCapabilities: function(test) {
    var cap = wps.getCapabilities();
    test.equal(typeof cap, "string");
    test.done();
  },

  testDescribeProcess: function(test) {
    var desc = wps.describeProcess();
    test.equal(typeof desc, "string");
    test.done();
  },

  testExecuteProcess: function(test) {
    var ex = [];
    var data = fs.readFileSync("samples/execute.xml", "utf8")
    var resp = wps.parseReqBody(ex, data); 
    test.equal(ex.length, 0);
    test.equal(resp.entries.length, 3, "Unable to parse entries");

    wps.execute(resp.ctx, resp.entries, 
      function(err) {
        // no error
        test.equal(undefined, err);
        test.done();
      },
      function(dbFile) {
        test.equal("string", typeof dbFile);
        fs.unlink(dbFile);
        test.done();
      } 
    );
  },

  testExecuteWFSProcess: function(test){
    var ex = [];
    var data = fs.readFileSync("samples/wfs_execute.xml", "utf8")
    var resp = wps.parseReqBody(ex, data); 

    test.equal(ex.length, 0);
    test.equal(resp.entries.length, 1, "Unable to parse entries");

    wps.execute(resp.ctx, resp.entries, 
      function(err) {
        // no error
        test.equal(undefined, err);
        test.done();
      },
      function(dbFile) {
        test.equal("string", typeof dbFile);
        fs.unlink(dbFile);
        test.done();
      } 
    );    
  },

  testExecuteGeoRSSProcess: function(test){
    var ex = [];
    var data = fs.readFileSync("samples/georss_execute.xml", "utf8")
    var resp = wps.parseReqBody(ex, data); 

    test.equal(ex.length, 0);
    test.equal(resp.entries.length, 1, "Unable to parse entries");

    wps.execute(resp.ctx, resp.entries, 
      function(err) {
        // no error
        test.equal(undefined, err);
        test.done();
      },
      function(dbFile) {
        test.equal("string", typeof dbFile);
        fs.unlink(dbFile);
        test.done();
      } 
    );    
  },

  testErrorMsg: function(test){
    var errMsg = wps.getError({
      exceptions: [{
        exceptionCode: "MissingParameterValue",
        locator: "request"
      }]
    });
    test.equal(typeof errMsg, "string");
    test.done();
  }
};
