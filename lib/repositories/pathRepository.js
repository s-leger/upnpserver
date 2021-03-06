/*jslint node: true */
"use strict";

var Util = require('util');
var Async = require('async');
var Path = require('path');

var debug = require('debug')('upnpserver:pathRepository');

var Repository = require('./repository');
var Item = require('../node');
var logger = require('../logger');

var AudioItem = require('../class/object.item.audioItem');
var VideoItem = require('../class/object.item.videoItem');
var ImageItem = require('../class/object.item.imageItem');

var BROWSE_FILES_LIMIT = 4;

var PathRepository = function(repositoryId, mountPath, path, searchClasses) {
  Repository.call(this, repositoryId, mountPath);

  if (Path.sep !== '/') {
    path = path.replace(/\\/g, '/');
  }

  if (searchClasses === undefined) {
    searchClasses = [ {
      name : AudioItem.UPNP_CLASS,
      includeDerived : true
    }, {
      name : ImageItem.UPNP_CLASS,
      includeDerived : true
    }, {
      name : VideoItem.UPNP_CLASS,
      includeDerived : true
    } ];
  }

  this.directoryPath = path;
  this.searchClasses = searchClasses;
};

Util.inherits(PathRepository, Repository);

module.exports = PathRepository;

PathRepository.prototype.initialize = function(service, callback) {

  this.contentProvider = service.getContentProvider(this.directoryPath);

  Repository.prototype.initialize.call(this, service, callback);
};

PathRepository.prototype.browse = function(list, node, callback) {
  if (node.getPath().indexOf(this.mountPath) !== 0) {
    return callback();
  }

  var self = this;

  var itemPath = node.getPath();
  var path = itemPath.substring(this.mountPath.length);
  var contentProvider = this.contentProvider;

  this._addSearchClasses(node);

  if (path) {
    path = "/" + path.replace(/^\//, '');
  }

  path = this.directoryPath + path;

  if (debug.enabled) {
    debug("PathRepository: browseNode=" + itemPath + " path=", path);
  }

  contentProvider.readdir(path, function(error, files) {
    if (error) {
      if (error.code === "ENOENT") {
        // It can be a virtual folder!

        if (debug.enabled) {
          debug("PathRepository: ENOENT for " + path);
        }
        return callback(null);
      }

      if (error.code === "EACCES") {
        // No right to read Folder

        logger.error("PathRepository: Can not read directory " + path);
        return callback(null);
      }

      logger.error("PathRepository: Error for " + path, error);
      return callback(error);
    }

    if (debug.enabled) {
      debug("PathRepository: path " + path + " returns " + files.length +
          " files");
    }

    Async.eachLimit(files, BROWSE_FILES_LIMIT, function(file, callback) {

      var p = file;
      contentProvider.stat(p, function(error, stats) {
        if (error) {
          logger.error("Stat error for ", p, error);
          return callback(null, list); // Access problem ...
        }

        if (stats.isDirectory()) {
          return self.addDirectory(node, p, stats, function(error, node) {
            if (error) {
              return callback(error);
            }

            if (node) {
              list.push(node);
            }
            callback();
          });
        }

        if (stats.isFile()) {
          return self.newFile(node, p, null, stats, function(error, node) {

            // console.log("Add item '" + p + "' returns ", node);

            if (error) {
              if (error.code === Repository.UPNP_CLASS_UNKNOWN) {
                return callback();
              }
              return callback(error);
            }

            if (node) {
              list.push(node);
            }
            return callback();
          });
        }

        logger.warn("Unsupported file '" + p + "' ", stats);
        callback();
      });

    }, function(error) {
      if (error) {
        return callback(error);
      }

      if (debug.enabled) {
        debug("PathRepository: END browse=", itemPath, " path=", path,
            " list.length=", list.length);
      }
      callback(null, list);
    });
  });
};

PathRepository.prototype._addSearchClasses = function(node) {
  if (!this.searchClasses) {
    return;
  }

  this.searchClasses.forEach(function(sc) {
    node.addSearchClass(sc.name, sc.includeDerived);
  });
};

PathRepository.prototype.addDirectory = function(parentNode, contentURL, stats,
    callback) {
  return this.newFolder(parentNode, contentURL, null, stats, null, callback);
};
