/*jslint node: true, white: true, bitwise: true, ass: true, unparam: true */
"use strict";
/*!
 * crafity-http - Crafity's lightweight and easy to use http server
 * Copyright(c) 2013 Crafity
 * Copyright(c) 2013 Bart Riemens
 * Copyright(c) 2013 Galina Slavova
 * MIT Licensed
 */

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Boolean} sensitive
 * @param  {Boolean} strict
 * @return {RegExp}
 * @api private
 */

function pathtoRegexp(path, keys, sensitive, strict) {
  if (path instanceof RegExp) { return path; }
  if (path instanceof Array) { path = '(' + path.join('|') + ')'; }
  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function (_, slash, format, key, capture, optional) {
      keys.push({ name: key, optional: !!optional });
      slash = slash || '';
      var emptyString = "";
      return emptyString + (optional ? '' : slash) + '(?:' +
        (optional ? slash : '') +
        (format || '') + (capture || ((format && '([^/.]+?)') || '([^/]+?)')) + ')' +
        (optional || '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
}

/**
 * Initialize `Route` with the given HTTP `path`,
 * and an array of `callbacks` and `options`.
 *
 * Options:
 *
 *   - `sensitive`    enable case-sensitive routes
 *   - `strict`       enable strict matching for trailing slashes
 *
 * @param {String} path
 * @param {Object} options.
 * @api private
 */

function Route(path, options) {
  options = options || {};
  this.path = path;
  this.method = 'GET';
  this.regexp = pathtoRegexp(path
    , this.keys = []
    , options.sensitive
    , options.strict);
}

/**
 * Return route middleware with
 * the given callback `fn()`.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

Route.prototype.middleware = function (fn) {
  var self = this;
  return function (ctx, next) {
    if (self.match(ctx.path, ctx.params)) { return fn(ctx, next); }
    return next();
  };
};

/**
 * Check if this route matches `path`, if so
 * populate `params`.
 *
 * @param {String} path
 * @param {Array} params
 * @return {Boolean}
 * @api private
 */

Route.prototype.match = function (path, params) {
  var keys = this.keys
    , qsIndex = path.indexOf('?')
    , pathname = qsIndex > -1 ? path.slice(0, qsIndex) : path
    , m = this.regexp.exec(pathname)
    , i
    , key
    , len
    , val;

  if (!m) { return false; }

  for (i = 1, len = m.length; i < len; ++i) {
    key = keys[i - 1];

    val = ('string' === typeof m[i]) ? decodeURIComponent(m[i]) : m[i];

    if (key) {
      params[key.name] = undefined !== params[key.name]
        ? params[key.name]
        : val;
    } else {
      params.push(val);
    }
  }

  return true;
};

/**
 * Expose `Route`.
 */

module.exports = Route;
module.exports.Route = Route;
