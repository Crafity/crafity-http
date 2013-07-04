var http = require('http')
  , Cookies = require('cookies')
  , qs = require('querystring')
  , util = require('util')
  , Route = require('./Route')
  , core = require('crafity-core')
  , gzip = require('crafity-gzip');

module.exports = function WebService(verbose) {
  this.__before = [];
  this.__routes = [];

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

  this.before(gzip.gzip());

  this.before(function deserializeCookies(req, res, next) {
    req.cookies = res.cookies = new Cookies(req, res);
    req.parse = qs.parse;
    next();
  });
  this.before(function parseBodyData(req, res, next) {
    if (!req.data || !req.parse) { return next(); }
    req.body = req.parse(req.data);
    next();
  });
  this.before(function createSendFunction(req, res, next) {
    res.send = function (statusCode, data, contentType) {
      res.statusCode = statusCode;
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "-1");
      if (typeof data === 'string') {
        res.setHeader("content-type", contentType || "text/html");
        res.end(data + "\n");
      } else {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(data) + "\n");
      }
    };
    next();
  });

  this.get = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required")}
    if (!this.__routes) { this.__routes = []; }
    this.__routes.push({ method: "GET", route: new Route(route), handlers: handlers });
  };

  this.del = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required")}
    if (!this.__routes) { this.__routes = []; }
    this.__routes.push({ method: "DELETE", route: new Route(route), handlers: handlers });
  };

  this.post = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required")}
    if (!this.__routes) { this.__routes = []; }
    //route = new RegExp("^" + route + "$", "i");
    this.__routes.push({ method: "POST", route: new Route(route), handlers: handlers });
  };
  this.put = function (route, handler) {
    var handlers = core.arrays.toArray(arguments).slice(1);
    if (!handlers.length) { throw new Error("A callback is required")}
    if (!this.__routes) { this.__routes = []; }
    this.__routes.push({ method: "PUT", route: new Route(route), handlers: handlers });
  };

  this.listen = function (port, callback) {
    var self = this;
    verbose && console.log("WebService::listening on port " + port);

    this.__server = http.createServer(function (req, res) {
      verbose && console.log("WebService::incoming request " + req.url);

      req.on("data", function (data) {
        req.data = (req.data || "") + data;
      });
      req.on("end", function () {

        (function enumerateBefore(beforeList) {
          if (beforeList.length === 0) { return determineRoute(); }
          var beforeFunction = beforeList.shift();
          return beforeFunction(req, res, function (err) {
            if (err) {
              verbose && console.log("err", err.message + "\n" + err.stack);
              return res.send(500, err.toString());
            }
            enumerateBefore(beforeList);
          });
        }(self.__before.slice()));

        function determineRoute() {
          for (var index = 0; index < self.__routes.length; index += 1) {
            var route = self.__routes[index]
              , params = {};

            if (route.route.match(req.url, params) &&
              req.method.match(route.method, "i")) {
              req.params = params;

              (function enumerateHandlers(handlers) {
                if (handlers.length === 0) { return null; }
                var handler = handlers.shift();
                try {
                  return handler(req, res, function () {
                    return enumerateHandlers(handlers);
                  });
                } catch (err) {
                  console.log("err", err.message + "\n" + err.stack);
                  return res.send(500, err.toString());
                }
              }(route.handlers.slice()));

              return null;
            }
          }
          res.statusCode = 404;
          return res.end("I'm sorry, but what you're looking for is not here.");
        }

      });

    });
    this.__server.on("error", callback || new Function());

    this.__server.listen(port, callback || new Function());
  };
  this.close = function (callback) {
    this.__server && this.__server.close(callback);
  };
};
