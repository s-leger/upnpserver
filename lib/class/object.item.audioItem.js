/*jslint node: true */
"use strict";

var Util = require('util');
var assert = require('assert');

var Res = require('./object.res');
var Item = require('./object.item');
var logger = require('../logger');

var AudioItem = function() {
  Res.call(this);
};

Util.inherits(AudioItem, Res);

module.exports = AudioItem;

AudioItem.UPNP_CLASS = Item.UPNP_CLASS + ".audioItem";
AudioItem.prototype.name = AudioItem.UPNP_CLASS;

AudioItem.prototype.getDLNA_ProfileName = function(item) {
  switch (item.attributes.mime) {
  case "audio/mpeg":
    return "MP3";
  break;
  case "audio/ogg":
    return "OGG";
  break;
  case "audio/aac":
    return "AAC";
  break;
  case "audio/aacp":
    return "AAC";
  break;
  case "audio/L16":
    return "LPCM";
  break;
  case "audio/L16p":
    return "LPCM";
  break;

  }

  return Res.prototype.getDLNA_ProfileName.call(this, item);
};


AudioItem.prototype.toJXML = function(node, attributes, request, callback) {

  var self = this;

  Res.prototype.toJXML.call(this, node, attributes, request, function(error,
      xml) {
    if (error) {
      return callback(error);
    }

    var content = xml._content;

    if (attributes.duration) {
      var d = attributes.duration;
      var ss = d % 60;
      d = (d - ss) / 60;
      var mm = d % 60;
      d = (d - mm) / 60;
      Item._getNode(xml, "res")._attrs.duration = ((d > 9) ? d : ("0" + d)) +
          ":" + ((mm > 9) ? mm : ("0" + mm)) + ":" +
          ((ss > 9) ? ss : ("0" + ss)) + ".000";
    }

    return callback(null, xml);
  });
};
