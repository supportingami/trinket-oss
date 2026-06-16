var config      = require('config'),
    constants   = require('./constants'),
    // Load routes BEFORE db because mongoose-schema-extend conflicts with Joi 17
    routes      = require('./routes'),
    api_routes  = require('./api_routes'),
    routeParser = require('../lib/util/routeParser'),
    db          = require('./db'),
    redis       = require('./redis'),
    node_env    = process.env.NODE_ENV || 'development';

config.isDev  = node_env === 'development';
config.isProd = node_env === 'production';
config.isTest = node_env === 'test';

// client-facing url
config.url = config.app.url.protocol + '://' + config.app.url.hostname;
if (config.app.url.port && config.app.url.port !== '80' && config.app.url.port !== '443' && config.app.url.port !== 80 && config.app.url.port !== 443) {
  config.url += ':' + config.app.url.port;
}

// viewing certain snapshots from browser
config.sandboxUrl = config.sandbox.url.protocol + '://' + config.sandbox.url.serverSubdomain + config.sandbox.url.domain;
if (config.sandbox.url.port) config.sandboxUrl += ':' + config.sandbox.url.port;

config.routes = routeParser.parse(api_routes.concat(routes));

module.exports = config;
