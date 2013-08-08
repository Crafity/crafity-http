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
	, EventEmitter = require('events').EventEmitter
	, version = process.versions.node.split('.')
	, oldVersion = version[0] === "0" && version[1] < 7
	, __logger = {}
	;

["log", "warn", "error"].forEach(function (name) {
	__logger[name] = function () {
		return;
	};
});

function WebService(logger) {
	if (logger) {
		this.__logger = logger;
	} else if (!this.__logger) {
		this.__logger = __logger;
	}

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
}

WebService.prototype = EventEmitter.prototype;

WebService.prototype.before = function before(handler) {
	if (!this.__before) { this.__before = []; }
	this.__before.push(handler);
};

WebService.prototype.get = function get(route, handler) {
	var handlers = core.arrays.toArray(arguments).slice(1);
	if (!handlers.length) { throw new Error("A callback is required"); }
	if (!this.__routes) { this.__routes = []; }
	this.__routes.push({ method: "GET", route: new Route(route), handlers: handlers });
};
WebService.prototype.del = function del(route, handler) {
	var handlers = core.arrays.toArray(arguments).slice(1);
	if (!handlers.length) { throw new Error("A callback is required"); }
	if (!this.__routes) { this.__routes = []; }
	this.__routes.push({ method: "DELETE", route: new Route(route), handlers: handlers });
};
WebService.prototype.post = function post(route, handler) {
	var handlers = core.arrays.toArray(arguments).slice(1);
	if (!handlers.length) { throw new Error("A callback is required"); }
	if (!this.__routes) { this.__routes = []; }
	//route = new RegExp("^" + route + "$", "i");
	this.__routes.push({ method: "POST", route: new Route(route), handlers: handlers });
};
WebService.prototype.put = function put(route, handler) {
	var handlers = core.arrays.toArray(arguments).slice(1);
	if (!handlers.length) { throw new Error("A callback is required"); }
	if (!this.__routes) { this.__routes = []; }
	this.__routes.push({ method: "PUT", route: new Route(route), handlers: handlers });
};

WebService.prototype.createRequestListener = function createRequestListener() {
	var self = this;
	return function (req, res) {
		self.__logger.log("WebService::incoming request " + req.url);

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
						self.__logger.error("err", err.message + "\n" + err.stack);
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
							self.__logger.error("err", err.message + "\n" + err.stack);
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
	};
};
WebService.prototype.listen = function listen(port, callback) {
	if (this.__server) {
		throw new Error("Server is already listening");
	}

	var self = this
		, requestListener = self.createRequestListener()
		, server = http.createServer(requestListener);

	self.__server = server;

	server.on("clientError", function (err, socket) {
		self.emit("clientError", err, socket);
	});
	server.on("close", function (err, socket) {
		self.emit("close", err, socket);
		this.__server = undefined;
	});

	server.listen(port, "127.0.0.1", callback);

	self.__logger.log("Listening on port " + port);
};
WebService.prototype.close = function close(callback) {
	if (!this.__server) { return; }
	if (!oldVersion) {
		this.__server.close();
		this.__server = undefined;
		return process.nextTick(callback);
	}
	this.__server.close(callback);
	this.__server = undefined;
};

module.exports = WebService;
