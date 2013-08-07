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
 * Module dependencies.
 */

var http = require('http')
  , Cookies = require('cookies')
  , qs = require('querystring')
  , util = require('util')
  , Route = require('./Route')
  , core = require('crafity-core')
  , gzip = require('crafity-gzip')
  , version = process.versions.node.split('.')
  , oldVersion = version[0] === "0" && version[1] < 7
  , closeEventName = oldVersion ? "exit" : "close";

module.exports = function WebService(logger) {
  if (logger) {
    this._logger = logger;
  }

  this.before = function (handler) {
    if (!this.__before) { this.__before = []; }
    this.__before.push(handler);
  };

  this.before(function addPumpToResponse(req, res, next) {
    res.pump = function (stream) {
      util.pump(stream, res);
    };
    next();
  });

  this.before(function createSendFunction(req, res, next) {
    res.send = function (statusCode, data, contentType) {
      if (typeof statusCode !== "number") {
        contentType = data;
        data = statusCode;
        statusCode = 200;
      }
      if (typeof contentType !== "string") {
        contentType = "text/html";
      }

      res.statusCode = statusCode;
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "-1");
      if (typeof data === 'string') {
        res.setHeader("content-type", contentType);
        res.end(data + "\n");
      } else if (data) {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(data) + "\n");
      } else {
        res.setHeader("content-type", contentType);
        res.end();
      }
    };
    res.sendError = function (err) {
      res.send(500, err.stack || err.toString(), "text/plain");
    };
    next();
  });
  this.before(gzip.gzip());
  this.before(function deserializeCookies(req, res, next) {
    req.cookies = res.cookies = new Cookies(req, res);
    req.parse = qs.parse;
    next();
  });
  this.before(function parseBodyData(req, res, next) {
    if (!req.data || !req.parse) { return next(); }
    if (req.headers['content-type'] && req.headers['content-type'].match(/JSON/i)) {
      req.body = JSON.parse(req.data);
    } else {
      req.body = req.parse(req.data);
    }
    next();
  });

  this.get = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required"); }
    if (!this.__routes) { this.__routes = []; }
    this.__routes.push({ method: "GET", route: new Route(route), handlers: handlers });
  };

  this.del = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required"); }
    if (!this.__routes) { this.__routes = []; }
    this.__routes.push({ method: "DELETE", route: new Route(route), handlers: handlers });
  };

  this.post = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required"); }
    if (!this.__routes) { this.__routes = []; }
    //route = new RegExp("^" + route + "$", "i");
    this.__routes.push({ method: "POST", route: new Route(route), handlers: handlers });
  };
  this.put = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required"); }
    if (!this.__routes) { this.__routes = []; }
    this.__routes.push({ method: "PUT", route: new Route(route), handlers: handlers });
  };

  this.listen = function (port, callback) {
    var self = this;

    if (self._logger) { self._logger.log("WebService::listening on port " + port);}

    this.__server = http.createServer(function (req, res) {
      if (self._logger) { self._logger.log("WebService::incoming request " + req.url); }

      req.on("data", function (data) {
        req.data = (req.data || "") + data;
      });
      req.on("end", function () {
        function determineRoute() {
          var index, route, params;

          function enumerateHandlers(handlers) {
            if (handlers.length === 0) { return null; }
            var handler = handlers.shift();
            try {
              return handler(req, res, function () {
                return enumerateHandlers(handlers);
              });
            } catch (err) {
              if (self._logger) { self._logger.error("err", err.message + "\n" + err.stack); }
              return res.send(500, err.toString());
            }
          }

          for (index = 0; index < (self.__routes && self.__routes.length) || 0; index += 1) {
            route = self.__routes[index];
            params = {};

            if (route.route.match(req.url, params) &&
              req.method.match(route.method, "i")) {
              req.params = params;

              enumerateHandlers(route.handlers.slice());

              return null;
            }
          }
          res.statusCode = 404;
          return res.end("I'm sorry, but what you're looking for is not here.\n");
        }

        (function enumerateBefore(beforeList) {
          if (beforeList.length === 0) { return determineRoute(); }
          var beforeFunction = beforeList.shift();
          try {
            return beforeFunction(req, res, function (err) {
              if (err) {
                if (self._logger) { self._logger.error("err", err.message + "\n" + err.stack); }
                return res.sendError(err);
              }
              enumerateBefore(beforeList);
            });
          } catch (err) {
            res.sendError(err);
            return enumerateBefore(beforeList);
          }
        }((self.__before && self.__before.slice()) || []));

      });

    });
    this.__server.on("error", callback || function () {
      return false;
    });

    this.__server.listen(port, "127.0.0.1", callback || function () {
      return false;
    });
  };
  this.close = function (callback) {
    if (this.__server) {
      if (!oldVersion) {
        return this.__server.close(callback);
      }
      this.__server.close();
      setTimeout(callback, 10);
    }
  };
};
