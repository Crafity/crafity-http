/*jslint node: true, white: true, unparam: true */
"use strict";
/*!
 * crafity-http - Crafity's lightweight and easy to use http server
 * Copyright(c) 2013 Crafity
 * Copyright(c) 2013 Bart Riemens
 * Copyright(c) 2013 Galina Slavova
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var WebService = require('../lib/WebService')
  , jstest = require('crafity-jstest').createContext("WebService")
  , core = require('crafity-core')
  , assert = jstest.assert
  ;

function createOptions(path, method, data) {
  var port = Math.floor(Math.random() * 1000) + 2000;
  return {
    hostname: 'localhost',
    port: port,
    path: path || '/',
    method: method || 'get',
    data: data,
    headers: {}
  };
}

jstest.run({
  "Verify the Web Service has the expected functionality and defaults": function () {
    var webservice = new WebService();

    assert.isDefined(webservice, "Expected a new instance of a Web Service");

    assert.isDefined(webservice.listen, "Expected a listen function");
    assert.isInstanceOf(Function, webservice.listen, "Expected a listen function");

    assert.isDefined(webservice.close, "Expected a close function");
    assert.isInstanceOf(Function, webservice.close, "Expected a close function");
  },
  "Start listening on a specific port number and stop listening after dispose": function (test) {
    test.async(5000);

    /* A R R A N G E */
    var webservice = new WebService()
      , options = createOptions("/version");

    webservice.get("/version", function (req, res) {
      return res.end("1.0\n");
    });
    
    test.steps([
      function assertBefore(next) {
        assert.request.fails(options, next);
      },
      function act(next) {
        webservice.listen(options.port, next);
      },
      function assertAfter(next) {
        assert.request.expect200(options, "1.0\n", next);
      },
      function cleanup(next) {
        webservice.close(next);
      }
    ]).on("complete", test.complete);
  },
  
  "Parse a route and return a param from the URL": function (test) {
    test.async(5000);

    /* A R R A N G E */
    var webservice = new WebService()
      , options = createOptions("/echo/this");

    webservice.get("/echo/:value", function (req, res) {
      return res.end(req.params.value + "\n");
    });
    
    test.steps([
      function arrange(next) {
        webservice.listen(options.port, next);
      },
      function act(next) {
        assert.request.expect200(options, "this\n", next);
      },
      function cleanup(next) {
        webservice.close(next);
      }
    ]).on("complete", test.complete);
  }
  
    
});

module.exports = jstest;
