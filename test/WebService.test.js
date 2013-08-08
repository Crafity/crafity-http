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

function createOptions(path, method, data, headers) {
	var port = Math.floor(Math.random() * 1000) + 2000;
	return {
		hostname: 'localhost',
		port: port,
		path: path || '/',
		method: method || 'get',
		data: data,
		headers: headers || {}
	};
}

function Logger(console) {
	this.console = console || false;
	this.messages = {
		log: [],
		warn: [],
		error: []
	};
}
Logger.prototype.log = function log() {
	if (this.console) { console.log.apply(this, arguments); }
	this.messages.log.push(arguments);
};
Logger.prototype.error = function error() {
	if (this.console) { console.error.apply(this, arguments); }
	this.messages.error.push(arguments);
};
Logger.prototype.warn = function warn() {
	if (this.console) { console.warn.apply(this, arguments); }
	this.messages.warn.push(arguments);
};

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
	"Handle a GET request and echo the URL parameter": function (test) {
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
	},
	"Handle a GET request and echo the body data": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this");

		webservice.get("/echo/:value", function (req, res) {
			return res.send(200);
		});

		test.steps([
			function arrange(next) {
				webservice.listen(options.port, next);
			},
			function act(next) {
				assert.request.expect200(options, "", next);
			},
			function cleanup(next) {
				webservice.close(next);
			}
		]).on("complete", test.complete);
	},
	"Handle a POST request and echo the body text": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this", "POST");

		webservice.post("/echo/:value", function (req, res) {
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
	},
	"Handle a POST request and echo the URL parameter": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var testData = { "hello": "world" };
		var webservice = new WebService()
			, options = createOptions("/echo/this", "POST", testData, { "Content-Type": "application/json" });

		webservice.post("/echo/:value", function (req, res) {
			return res.send(req.body);
		});

		test.steps([
			function arrange(next) {
				webservice.listen(options.port, next);
			},
			function act(next) {
				assert.request.expect200(options, JSON.stringify(testData) + "\n", next);
			},
			function cleanup(next) {
				webservice.close(next);
			}
		]).on("complete", test.complete);
	},
	"Handle a PUT request and echo the URL parameter": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this", "PUT", { "hello": "world" });

		webservice.put("/echo/:value", function (req, res) {
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
	},
	"Handle a DELETE request and echo the URL parameter": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this", "DELETE");

		webservice.del("/echo/:value", function (req, res) {
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
	},
	"Insert a 'before' request handler and verify it is being called": function (test) {
		test.async(2000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this")
			, beforeCalled = false
			;

		webservice.before(function (req, res, next) {
			beforeCalled = true;
			next();
		});

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
			},
			function assertOutcome(next) {
				assert.isTrue(beforeCalled, "Expected 'before' request handler to be called");
				next();
			}
		]).on("complete", test.complete);
	},
	"Insert a 'before' request handler return an error and verify it is being handled correctly": function (test) {
		test.async(2000);

		/* A R R A N G E */
		var logger = new Logger(false)
			, webservice = new WebService(logger)
			, options = createOptions("/echo/this")
			, error = new Error("This is a test error to test a bogus before handler")
			, beforeCalled = false
			;

		webservice.before(function (req, res, next) {
			beforeCalled = true;
			next(error);
		});

		webservice.get("/echo/:value", function (req, res) {
			return res.end(req.params.value + "\n");
		});

		test.steps([
			function arrange(next) {
				webservice.listen(options.port, next);
			},
			function act(next) {
				assert.request.expect500(options, error.stack + "\n", next);
			},
			function cleanup(next) {
				webservice.close(next);
			},
			function assertOutcome(next) {
				assert.isTrue(beforeCalled, "Expected 'before' request handler to be called");
				assert.areEqual(logger.messages.error[0], ["err", error.message + "\n" + error.stack], "Expected an error to be logged");
				next();
			}
		]).on("complete", test.complete);
	},
	"Insert a buggy 'before' request handler and verify it is being handled correctly": function (test) {
		test.async(2000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this")
			, error = new Error("This is a test error to test a bogus before handler")
			, beforeCalled = false
			;

		webservice.before(function (req, res, next) {
			beforeCalled = true;
			throw error;
		});

		webservice.get("/echo/:value", function (req, res) {
			return res.end(req.params.value + "\n");
		});

		test.steps([
			function arrange(next) {
				webservice.listen(options.port, next);
			},
			function act(next) {
				assert.request.expect500(options, error.stack + "\n", next);
			},
			function cleanup(next) {
				webservice.close(next);
			},
			function assertOutcome(next) {
				assert.isTrue(beforeCalled, "Expected 'before' request handler to be called");
				next();
			}
		]).on("complete", test.complete);
	},
	"Handle an unkown request and return a 404": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/doesnotexist");

		test.steps([
			function arrange(next) {
				webservice.listen(options.port, next);
			},
			function act(next) {
				assert.request.expect404(options, "I'm sorry, but what you're looking for is not here.\n", next);
			},
			function cleanup(next) {
				webservice.close(next);
			}
		]).on("complete", test.complete);
	},
	"Check the verbose option": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService(new Logger())
			, options = createOptions("/doesnotexist");

		test.steps([
			function arrange(next) {
				webservice.listen(options.port, next);
			},
			function act(next) {
				assert.request.expect404(options, "I'm sorry, but what you're looking for is not here.\n", next);
			},
			function cleanup(next) {
				webservice.close(next);
			}
		]).on("complete", test.complete);
	},
	"Test the send html function": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this");

		webservice.get("/echo/:value", function (req, res) {
			return res.send(req.params.value);
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
	},
	"Test the send error function": function (test) {
		test.async(5000);

		/* A R R A N G E */
		var webservice = new WebService()
			, options = createOptions("/echo/this")
			, error = new Error("This is a test message")
			;

		webservice.get("/echo/:value", function (req, res) {
			return res.sendError(error);
		});

		test.steps([
			function arrange(next) {
				webservice.listen(options.port, next);
			},
			function act(next) {
				assert.request.expect500(options, error.stack + "\n", next);
			},
			function cleanup(next) {
				webservice.close(next);
			}
		]).on("complete", test.complete);
	}

});

module.exports = jstest;
