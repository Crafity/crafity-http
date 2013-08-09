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
		return null;
	};
});

function WebService(logger) {
	if (logger) {
		this.logger = logger;
	} else if (!this.logger) {
		this.logger = __logger;
	}

	this.before(this.decorateRequestResponse);
}

WebService.prototype = EventEmitter.prototype;

WebService.prototype.before = function before(handler) {
	if (!this.__before) { this.__before = []; }
	this.__before.push(handler);
};

WebService.prototype.all = function all(route, handler) {
	var handlers = core.arrays.toArray(arguments).slice(1);
	if (!handlers.length) { throw new Error("A callback is required"); }
	if (!this.__routes) { this.__routes = []; }
	this.__routes.push({ method: "ALL", route: new Route(route), handlers: handlers });
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

WebService.prototype.decorateRequestResponse = function decorateRequestResponse(req, res, next) {
	this.logger.log("WebService::Processing core request handler pipeline");

	res.pump = function (stream) {
		util.pump(stream, res);
	};

	this.logger.log("WebService::Parsing cookies");
	req.cookies = res.cookies = new Cookies(req, res);
	req.parseQueryString = qs.parse;

	if (req.data) {
		this.logger.log("WebService::Parsing body data");
		if (req.headers['content-type'] && req.headers['content-type'].match(/JSON/i)) {
			req.body = JSON.parse(req.data);
		} else {
			req.body = qs.parse(req.data);
		}
	}

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
};
WebService.prototype.processBeforeHandlers = function processBeforeHandlers(beforeList, req, res, callback) {
	if (beforeList.length === 0) { return callback(null); }

	var self = this
		, beforeFunction = beforeList.shift();

	return process.nextTick(function () {
		try {
			return beforeFunction.call(self, req, res, function (err) {
				if (err) { return callback(err); }
				return self.processBeforeHandlers(beforeList, req, res, callback);
			});
		} catch (err) {
			return callback(err);
		}
	});
};
WebService.prototype.processHandlers = function processHandlers(handlers, req, res, callback) {
	if (handlers.length === 0) { return callback(null); }

	var self = this
		, handler = handlers.shift();

	return process.nextTick(function () {
		try {
			return handler.call(self, req, res, function next(err) {
				if (err) { return callback(err); }
				return self.processHandlers(handlers, req, res, callback);
			});
		} catch (err) {
			return callback(err);
		}
	});
};
WebService.prototype.processRoutes = function processRoutes(req, res, callback) {
	var self = this
		, index, route, params;

	for (index = 0; index < (self.__routes && self.__routes.length) || 0; index += 1) {
		route = self.__routes[index];
		params = {};

		if (route.route.match(req.url, params) &&
			(route.method === "ALL" || req.method.match(route.method, "i"))) {
			req.params = params;

			return self.processHandlers(route.handlers.slice(), req, res, callback);
		}
	}
	return res.send(404, "I'm sorry, but what you're looking for is not here.");
};
WebService.prototype.requestListener = function requestListener(req, res) {
	var self = this
		, beforeList = (self.__before && self.__before.slice()) || [];

	self.logger.log("WebService::incoming '" + req.method + "' request " + req.url);

	req.on("data", function (data) {
		req.data = (req.data || "") + data;
	});

	req.on("end", function () {

		self.processBeforeHandlers(beforeList, req, res, function (err) {
			if (err) {
				self.logger.error("err", err.message + "\n" + err.stack);
				return res.sendError(err);
			}
			return self.processRoutes(req, res, function (err) {
				if (err) {
					self.logger.error("err", err.message + "\n" + err.stack);
					return res.sendError(err);
				}
				return null;
			});
		});

	});
};

WebService.prototype.listen = function listen(port, callback) {
	if (this.__server) {
		throw new Error("Server is already listening");
	}

	var self = this
		, server = http.createServer(function () {
			self.requestListener.apply(self, arguments);
		});

	self.__server = server;

	server.on("clientError", function (err, socket) {
		self.emit("clientError", err, socket);
	});
	server.on("close", function (err, socket) {
		self.emit("close", err, socket);
		self.__server = undefined;
	});

	server.listen(port, "127.0.0.1", callback);

	self.logger.log("WebService::Listening on port " + port);
};
WebService.prototype.close = function close(callback) {
	if (!this.__server) { return null; }
	if (oldVersion) {
		this.__server.close();
		this.__server = undefined;
		return process.nextTick(callback);
	}
	this.__server.close(callback);
	this.__server = undefined;
	return null;
};

module.exports = WebService;
