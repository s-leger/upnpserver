var redis = require('fakeredis');
// var redis = require('redis');
var debug = require('debug')('upnpserver:redis');
var Node  = require('../node.js');
var noop = function(){};
/*
    configuration.registryDb = "redis";
    configuration.redis = {
      port: "6379",
      host: "127.0.0.1",
      db: 9,
      pass: "password_of_redis_db"
    }
*/
var RedisRegistry = function(configuration) {
  var self = this;
  var options = configuration.redis;

  self.prefix = 'upnpserver:';
  self.client = fakeredis.createClient(self.prefix);
  /*
  var redis_opts 	= {db:options.db , auth_pass: options.pass};
  self.client 			= redis.createClient(options.port, options.host, redis_opts)
  */

  self.client.on('error', function (er) {
    debug('Redis returned err', er);
  });
  self.client.on('connect', function () {
    debug('Redis connected');
  });
};

module.exports = RedisRegistry;

RedisRegistry.prototype.initialize = function(service, callback) {

  callback(null);
};

RedisRegistry.prototype.clear = function(item, callback) {
  self.client.flushdb();
  return callback(null, item);
};

RedisRegistry.prototype.registerNode = function(item, fn) {
  var store = this;
  var psid = store.prefix + item.id;
  if (!fn) fn = noop;

  try {
    var jitem = item.toJSON();
  }
  catch (er) {
    return fn(er);
  }

  debug('SET "%s" %s', item.id, jitem);
  store.client.set(psid, jitem, function (er) {
    if (er) return fn(er);
    debug('SET complete');
    fn.apply(null, arguments);
  });

  return fn(null, item);
};

RedisRegistry.prototype.getNodeById = function(id, fn) {

  var store = this;
  var psid = store.prefix + id;
  if (!fn) fn = noop;
  debug('GET "%s"', id);

  store.client.get(psid, function (er, data) {
    if (er) return fn(er);
    if (!data) return fn(new Error("not found"));

    var result;
    data = data.toString();
    debug('GOT %s', data);

    try {
      result = Node.fromJSON(data);
    }
    catch (er) {
      return fn(er);
    }
    return fn(null, result);
  });

};

Registry.prototype.unregisterNodeById = function(id, fn) {
  var sid = this.prefix + item.id;
  debug('DEL "%s"', sid);
  this.client.del(sid, fn);
};
