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
    var features = [];
    var ex = [];
    var data = fs.readFileSync("samples/execute.xml", "utf8")
    var features = wps.parseReqBody(ex, data); 
    test.equal(ex.length, 0);
    test.equal(features.length, 3, "Unable to parse features");
    test.done();
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
