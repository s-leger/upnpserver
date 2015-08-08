/*jslint node: true, plusplus: true, nomen: true, vars: true */
"use strict";
var	http 				= require('http')
,		sys 				= require('sys')
,   util        = require('util')
,   async       = require("async")
,   path        = require('path')
,		fs					= require('fs')
,   Semaphore   = require('semaphore')
,   debug       = require('debug')('upnpserver:repository:IceCast')
,   logger      = require('../logger')
,   Repository  = require('./repository')
,   ContentDirectoryService = require('../contentDirectoryService')
,   Item        = require('../class/object.item')
,   MusicGenre  = require('../class/object.container.genre.musicGenre')
,   AudioBroadcast = require('../class/object.item.audioItem.audioBroadcast')
;
var FILES_PROCESSOR_LIMIT = 25;

/**
* IceCast (unofficial) json API
* TODO: move this in config files
* const API_URL = "http://api.include-once.org/xiph/cache.php";
* user-agent is needed here to prevent 403 responses
*/
var ICECAST_API = {
	hostname: 'api.include-once.org',
	path: '/xiph/cache.php',
	headers: {
		'Connection':	'keep-alive',
		'user-agent': 'Mozilla/5.0 (Windows NT 5.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.124 Safari/537.36',
		'Accept':			'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
	}
};

var ICECAST_CACHE 			= path.resolve(__dirname + "../../../cache/playlist.json");
var ICECAST_UPDATEDELAY = 6*60*60*1000; // update stations every 6 hours


var IceCastRepository = module.exports = function(repositoryId, mountpath, searchClasses) {

	Repository.call(this, repositoryId, mountpath, searchClasses);

	this._scannerSemaphore = Semaphore(1);
};

util.inherits(IceCastRepository, Repository);

IceCastRepository.prototype.initialize = function(service, callback) {

	this.contentDirectoryService = service;

	var self = this;
	var log = false;
	self.nextUpdate = new Date().getTime()+ICECAST_UPDATEDELAY;
	self.dirty = false;


	function scan(root, nodes) {

			self.scan(root, nodes, function(err, root, list, chidrens){
				self.update(err, root, list, chidrens, function(err){
					if (err) logger.error(err);
				});
			});
	}


	Repository.prototype.initialize.call(this, service, function(error, root) {
		if (error) {
			return callback(error);
		}


		setInterval(function(){
			var now = new Date().getTime();
			if (now > self.nextUpdate){
				self.nextUpdate = now+ICECAST_UPDATEDELAY;
				self.dirty = true;
				// clean up childs
				debug("start garbage");
				self.getNodeList(root, null, function(err, list){
					scan(root, list);
				});
				/*
				node._garbageChild(function(err){
					if (err) return logger.error(err);
					// then rebuild chils
					scan();
				});
				*/
			}
		}, ICECAST_UPDATEDELAY);


		setImmediate(function(){
			scan(root, []);
		});

		callback(null, root);
	});
};

// fs.writeFile(__dirname+'/icecast.m3u', playlist,function(err,res){});
IceCastRepository.prototype.createBroadcastItem = function (item, genres){
	if (genres.length < 1)
		genres.push("mixed");
	return {
		contentURL: item.listen_url,
		genres:     genres,
		bitrate:    item.bitrate,
		mime:       item.type,
		title:      item.stream_name,
		date: 			new Date().getTime(),
		external: 	true,
		size:				-1
	}
}

IceCastRepository.prototype._parsePlaylist	= function (body, callback){

	var self = this;

	// sort streams by name
	function sortByName(a, b){
		if (a.stream_name < b.stream_name) return 1;
		if (a.stream_name > b.stream_name) return -1;
		return 0;
	}

	if ((/DOCTYPE HTML/g).test(body)){
		// skip parsing when server respond with 403 Forbidden
		logger.error("Error in IceCastRepository parsePlaylist : body is not a valid json content (DOCTYPE HTML)");
		return false;
	}

	var playlist = JSON.parse(body);
	// console.log("****** parsePlaylist : success *******");
	playlist.sort(sortByName);

	// Parse genres, store occurences
	var genres = playlist.reduce(function(prev, media){
		var genre = media.genre.replace(/'s/g," ")
		.replace(/-/g,'_')
		.replace(/([0-9]+)(er|s)/g,"$1")
		.replace(/(^|[\s\t]+)[A-Za-z0-9]([\s\t]+|$)/g,' ')
		.replace(/(\.)/g,' ')
		.replace(/(^|[\s\t]+)mutch([\s\t]+|$)/g,' ')
		.replace(/(^|[\s\t]+)more([\s\t]+|$)/g,' ')
		.replace(/(^|[\s\t]+)and([\s\t]+|$)/g,' ')
		.replace(/(^|[\s\t]+)the([\s\t]+|$)/g,' ')
		.replace(/(^|[\s\t]+)by([\s\t]+|$)/g,' ');

		//	console.log(cur.genre+'  =  '+genre);
		media.genres = [];
		if (genre.trim() === "") return prev;
		if (/\s/.test(genre)){
			genre.split(' ').forEach(function(cur){
				cur = cur.trim();
				if (cur !== ""){
					if(prev[cur]) prev[cur] += 1;
					else prev[cur] = 1;
					media.genres.push(cur);
				}
			});
		}
		else {
			genre = genre.trim();
			if (genre !== "")
			if(prev[genre]) prev[genre] += 1;
			else prev[genre] = 1;
			media.genres.push(genre);
		}
		return prev;
	}, {});

	// filter genres > 50 occurences
	playlist = playlist.map(function(media){
		var g = media.genres.filter(function(genre){
			return (genres[genre] > 50);
		});
		return self.createBroadcastItem(media,g);
	});
	return playlist;
}

IceCastRepository.prototype.getNodeList = function(parent, list, callback) {
  var self = this;
  if (list == undefined) list = [];

	if (parent.refID || parent.upnpClass && parent.upnpClass.name === "object.item.audioItem.audioBroadcast"){
		list.push(parent);
	}
  if (!parent.upnpClass || !parent.upnpClass.isContainer) {
    return callback(null, list);
  }

  if (!parent._childrenIds) {
    if (!parent.refID) {
    }
    return callback(null, list);
  }

  var service = parent.getService();

  async.eachSeries(parent._childrenIds, function(childId, callback) {
    service.getNodeById(childId, function(error, child) {
      if (error) {
        return callback(error);
      }

      if (!child) {
        return callback(null);
      }

      self.getNodeList(child, list, callback);
    });

  }, function(error) {
    callback(error, list);
  });
};

IceCastRepository.prototype.filesToAdd = function(nodes, files){
	var oldURLs = nodes.reduce(function(all, node){
			if (node.refID) return all;
			else all.push(node.attributes.contentURL);
			return all;
		}, []);
	// add files only when url are not found within current nodes set
	var filesToAdd		= files.filter(function(file){
		return oldURLs.indexOf(file.contentURL) < 0;
	});
	debug("fileToAdd count :"+filesToAdd.length+
			" Nodes urls count :"+oldURLs.length+
			" Nodes count"+ nodes.length);
	console.log(util.inspect(filesToAdd));
  return filesToAdd;
}

IceCastRepository.prototype.refsToRemove = function(nodes, toRemove){
		var idsToRemove = toRemove.map(function(node){return node.id});
		var refsToRemove = nodes.filter(function(node){
			return node.refID && idsToRemove.indexOf(node.refID) > -1;
		});
		return refsToRemove;
}

IceCastRepository.prototype.nodesToRemove = function(nodes, files){
	var newURLs = files.map(function(attr){return attr.contentURL});
	// remove nodes not found in files
	var nodesToRemove	= nodes.filter(function(node){
		return !node.refID && newURLs.indexOf(node.attributes.contentURL) < 0;
	});
	debug("nodes count:"+nodes.length+
			" nodesToRemove count :"+nodesToRemove.length+
			" files urls count :"+newURLs.length+
			" files count"+ files.length);
	console.log(util.inspect(nodesToRemove));
	return nodesToRemove;
}

IceCastRepository.prototype.update = function(err, root, list, childs, callback){

		var self = this;

		if (err){
			return callback(err);
		}
		var nodes = self.nodesToRemove(childs, list);
		var refs = self.refsToRemove(childs, nodes);
		var files = self.filesToAdd(childs, list);

		async.series({
			add: function(next){
					async.eachLimit(files, FILES_PROCESSOR_LIMIT, function(infos, callback) {
						self.processFile(root, infos, function(error) {
							if (error) {
								logger.error("Process file node=#" + root.id + " infos=", infos,
								" error=", error);
							}

							setImmediate(callback);
						});

						}, function(error) {
							if (error) {
								logger.error("Error while scaning files ", error);
								return next(error);
							}
							debug(files.length + " files processed");

							next(null, true);
						});

				},
  	  refs: function(next){
				async.eachLimit(refs, FILES_PROCESSOR_LIMIT, function(child, callback) {
					child.getParent(function(err, parent){
						if (err) return callback(err);
						parent.removeChild(child, callback);
					});
					}, function(error) {
						if (error) {
							logger.error("Error while removing nodes ", error);
							return next(error);
						}
						debug(refs.length + " refs removed");

						next(null, true);
					});
			},
			remove: function(next){

				async.eachLimit(nodes, FILES_PROCESSOR_LIMIT, function(child, callback) {
					child.getParent(function(err, parent){
						if (err) return callback(err);
						parent.removeChild(child, callback);
					});
					}, function(error) {
						if (error) {
							logger.error("Error while removing nodes ", error);
							return next(error);
						}
						debug(nodes.length + " nodes removed");

						next(null, true);
					});

			}
		},
		function(err){
			callback(err);
		});
}

IceCastRepository.prototype.scan = function(root, nodes, callback){
	var self = this;

	fs.stat(ICECAST_CACHE, function(err, stats){

		var now = new Date().getTime();
		if (!self.dirty && !err && stats.isFile() && (stats.mtime.getTime() + ICECAST_UPDATEDELAY <  now)){
			debug("read cache file");
			fs.readFile(ICECAST_CACHE, function(err, body){
				if (err) return callback(err);
				var files = self._parsePlaylist(body);
				callback(err, root, files, nodes);
			})

		}
		else {
			debug("request iceCast list from online server");
			var req = http.request(ICECAST_API, function(res){
				var body = "";
				res.setEncoding('utf8');
				res.on('data', function(chunk) { body += chunk });
				res.on('end', function() {
					debug("save cache file");
					fs.writeFile(ICECAST_CACHE, body, function(err, res){
						if (err) return callback(err);
						var files = self._parsePlaylist(body);
						callback(err, root, files, nodes);

					});
				});
			});
			req.on('error', function(err) {
				logger.error(err);
				callback(err);
			});
			req.end();
		}

	});

}

IceCastRepository.prototype.keepFile = function(infos) {
	var mime = infos.mime;
	var mimePart = mime.split("/");

	if (mimePart.length !== 2 || mimePart[0] !== "audio") {
		return false;
	}

	if (mimePart[1] === "x-mpegurl") {
		return false; // Dont keep .m3u
	}

	return true;
};

IceCastRepository.prototype.processFile = function(rootItem, attributes, callback) {

	var i18n = this.contentDirectoryService.upnpServer.configuration.i18n;

	var self = this;

	var name = attributes.title;
	var semaphore = this._scannerSemaphore;

	this.contentDirectoryService.createNode(name, AudioBroadcast.UPNP_CLASS, attributes, function(error, node) {
		if (error) {
			return callback(error);
		}

		node.getAttributes(ContentDirectoryService.MED_PRIORITY, function(error, attributes) {

			semaphore.take(function() {

				var title = attributes.title || node.name || i18n.UNKNOWN_TITLE;
				var genres = attributes.genres || [ i18n.UNKNOWN_GENRE ];

				var itemData = {
					node : node,

					title : title,
					genres : genres
				};

				var tasks = [];

				if (genres) {
					genres.forEach(function(genre) {
						if (!genre) {
							// genre = i18n.UNKNOWN_GENRE;
							return;
						}
						genre = genre.trim();
						tasks.push({
							fn : self.registerGenresFolder,
							param : genre
						});
					});
				}

				async.eachSeries(tasks, function(task, callback) {

					task.fn.call(self, rootItem, itemData, task.param, callback);

				}, function(error) {
					semaphore.leave();

					if (error) {
						return callback(error);
					}

					callback();
				});

			});
		});
	});
};

IceCastRepository.prototype.registerAudioBroadcast = function(parentItem, itemData, tryCount, callback) {

	var t = itemData.title;
	if (tryCount) {
		t += "  #" + (tryCount) + "";
	}

	var self = this;
	parentItem.getChildByName(t, function(error, audioBroadcast) {
		if (error) {
			return callback(error);
		}

		debug("Find '" + t + "' in #" + parentItem.id + " => " + audioBroadcast);

		if (audioBroadcast) {
			audioBroadcast.resolveLink(function(error, mu) {
				if (mu.attributes.contentURL === itemData.contentURL) {
					itemData.audioBroadcast = mu;

					return callback(null, mu);
				}

				debug("Register title on " + parentItem.id + " title=" + t);

				self.registerAudioBroadcast(parentItem, itemData, tryCount + 1, callback);
			});
			return;
		}

		if (itemData.audioBroadcast) {

			debug("Link title on " + parentItem.id + " title=" + t);

			return self.newNodeRef(parentItem, itemData.audioBroadcast, null,
				callback);
			}

			if (itemData.node) {
				parentItem.appendChild(itemData.node, function(error) {
					if (error) {
						return callback(error);
					}

					itemData.audioBroadcast = itemData.node;
					delete itemData.node;

					callback(null, itemData.audioBroadcast);
				});
				return;
			}

			throw new Error("Never happen ! " + util.inspect(itemData));
		});
	};


	IceCastRepository.prototype.registerGenresFolder = function(parentItem, itemData,	genreName, callback) {

		var self = this;
		parentItem.getChildByName(genreName, function(error, genreItem) {
			if (error) {
				return callback(error);
			}

			if (genreItem) {
				return self.registerAudioBroadcast(genreItem, itemData, 0, callback);
			}

			self.newVirtualContainer(parentItem, genreName, MusicGenre.UPNP_CLASS, null, function(error, genreItem) {

				if (error) {
					return callback(error);
				}

				self.registerAudioBroadcast(genreItem, itemData, 0, callback);
			});
		});
	};
