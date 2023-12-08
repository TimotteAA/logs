### connect源码阅读
```js
/*!
 * connect
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

var debug = require('debug')('connect:dispatcher');
var EventEmitter = require('events').EventEmitter;
var finalhandler = require('finalhandler');
var http = require('http');
var merge = require('utils-merge');
var parseUrl = require('parseurl');

/**
 * Module exports.
 * @public
 */

module.exports = createServer;

/**
 * Module variables.
 * @private
 */

var env = process.env.NODE_ENV || 'development';
var proto = {};

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Create a new connect server.
 *
 * @return {function}
 * @public
 */

function createServer() {
  // app() <=> app.handle()
  function app(req, res, next){ app.handle(req, res, next); }
  // 把proto上的属性放到app上去
  merge(app, proto);
  // 把EventEmitter原型上的属性放到app上去
  merge(app, EventEmitter.prototype);
  app.route = '/';
  app.stack = [];
  return app;
}

/**
 * Utilize the given middleware `handle` to the given `route`,
 * defaulting to _/_. This "route" is the mount-point for the
 * middleware, when given a value other than _/_ the middleware
 * is only effective when that segment is present in the request's
 * pathname.
 *
 * For example if we were to mount a function at _/admin_, it would
 * be invoked on _/admin_, and _/admin/settings_, however it would
 * not be invoked for _/_, or _/posts_.
 *
 * @param {String|Function|Server} route, callback or server
 * @param {Function|Server} callback or server
 * @return {Server} for chaining
 * @public
 */
// express中间件栈模型
proto.use = function use(route, fn) {
  var handle = fn;
  var path = route;

  // 没有传入route，类似于全局中间件
  // default route to '/'
  if (typeof route !== 'string') {
    handle = route;
    path = '/';
  }

  // 如果带handle方法，则视为传入另一个app
  if (typeof handle.handle === 'function') {
    // 挂了一个子server，外面的handle会传给子server
    var server = handle;
    server.route = path;
    handle = function (req, res, next) {
      server.handle(req, res, next);
    };
  }

  // wrap vanilla http.Servers
  if (handle instanceof http.Server) {
    handle = handle.listeners('request')[0];
  }

  // 去末尾斜杠
  // strip trailing slash
  if (path[path.length - 1] === '/') {
    path = path.slice(0, -1);
  }

  // add the middleware
  debug('use %s %s', path || '/', handle.name || 'anonymous');
  this.stack.push({ route: path, handle: handle });

  return this;
};

/**
 * Handle server requests, punting them down
 * the middleware stack.
 *
 * @private
 */

proto.handle = function handle(req, res, out) {
  // 正在执行的中间件索引
  var index = 0;
  // 域名
  var protohost = getProtohost(req.url) || '';
  // req.url和中间件匹配后，根据中间件path移除的url
  var removed = '';
  // 是否对url补了前置的 /
  var slashAdded = false;
  // 中间件栈
  var stack = this.stack;

  // 最后一个执行的函数，可以是外面传入的next
  var done = out || finalhandler(req, res, {
    env: env,
    onerror: logerror
  });

  // store the original URL
  req.originalUrl = req.originalUrl || req.url;

  // 同步函数，不具备类似koa的异步能力
  function next(err) {
    // 之前的中间件加了前置 /，，去掉
    if (slashAdded) {
      req.url = req.url.substr(1);
      slashAdded = false;
    }

    // 之前匹配的中间件进行前缀匹配，还原完整的url
    // req.url是当前匹配段，req.originalUrl是完整的url
    if (removed.length !== 0) {
      req.url = protohost + removed + req.url.substr(protohost.length);
      removed = '';
    }

    // 当前中间件
    var layer = stack[index++];

    // 异步调用收尾函数
    if (!layer) {
      defer(done, err);
      return;
    }

    // 请求的pathname
    var path = parseUrl(req).pathname || '/';
    // 中间件上的路由信息
    var route = layer.route;
    // 请求的url和当前路由不符，执行下个中间件，这里匹配了中间件的前缀
    if (path.toLowerCase().substr(0, route.length) !== route.toLowerCase()) {
      console.log("route not match ", route)
      return next(err);
    }

    // skip if route match does not border "/", ".", or end
    // 前缀不完全匹配
    // path = /abca
    // 中间件的路由是 /abc
    var c = path.length > route.length && path[route.length];
    if (c && c !== '/' && c !== '.') {
      return next(err);
    }

    // trim off the part of the url that matches the route
    if (route.length !== 0 && route !== '/') {
      removed = route;
      // 请求上去掉匹配的前缀，比如/abc/foo，会去掉/abc，留下/foo
      // req.originalUrl则是完整的url
      // req.url是匹配前缀后的后缀
      req.url = protohost + req.url.substr(protohost.length + removed.length);

      // ensure leading slash
      if (!protohost && req.url[0] !== '/') {
        req.url = '/' + req.url;
        slashAdded = true;
      }
    }

    // call the layer handle
    call(layer.handle, route, err, req, res, next);
  }

  next();
};

/**
 * Listen for connections.
 *
 * This method takes the same arguments
 * as node's `http.Server#listen()`.
 *
 * HTTP and HTTPS:
 *
 * If you run your application both as HTTP
 * and HTTPS you may wrap them individually,
 * since your Connect "server" is really just
 * a JavaScript `Function`.
 *
 *      var connect = require('connect')
 *        , http = require('http')
 *        , https = require('https');
 *
 *      var app = connect();
 *
 *      http.createServer(app).listen(80);
 *      https.createServer(options, app).listen(443);
 *
 * @return {http.Server}
 * @api public
 */

proto.listen = function listen() {
  var server = http.createServer(this);
  return server.listen.apply(server, arguments);
};

/**
 * Invoke a route handle.
 * @private
 */

function call(handle, route, err, req, res, next) {
  var arity = handle.length;
  var error = err;
  var hasError = Boolean(err);

  debug('%s %s : %s', handle.name || '<anonymous>', route, req.originalUrl);

  try {
    if (hasError && arity === 4) {
      // error-handling middleware
      handle(err, req, res, next);
      return;
    } else if (!hasError && arity < 4) {
      // request-handling middleware
      handle(req, res, next);
      return;
    }
  } catch (e) {
    // replace the error
    error = e;
  }

  // continue
  next(error);
}

/**
 * Log error using console.error.
 *
 * @param {Error} err
 * @private
 */

function logerror(err) {
  if (env !== 'test') console.error(err.stack || err.toString());
}

/**
 * Get get protocol + host for a URL.
 *
 * @param {string} url
 * @private
 */

function getProtohost(url) {
  if (url.length === 0 || url[0] === '/') {
    return undefined;
  }

  var fqdnIndex = url.indexOf('://')

  return fqdnIndex !== -1 && url.lastIndexOf('?', fqdnIndex) === -1
    ? url.substr(0, url.indexOf('/', 3 + fqdnIndex))
    : undefined;
}

```
