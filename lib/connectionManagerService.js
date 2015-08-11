/*jslint node: true */
"use strict";

var Util = require('util');

var Service = require("./service");

var ConnectionManagerService = function() {
  Service.call(this, {
    serviceType : "urn:schemas-upnp-org:service:ConnectionManager:1",
    serviceId : "urn:upnp-org:serviceId:ConnectionManager",
    scpdURL : "/service/connectionmanager/description.xml",
    controlURL : "/service/connectionmanager/control",
    eventSubURL : "/service/connectionmanager/event"
  });

  this.addAction("GetCurrentConnectionIDs", [], [ {
    name : "ConnectionIDs",
    type : "CurrentConnectionIDs"
  } ]);
  this.addAction("GetCurrentConnectionInfo", [ {
      name : "ConnectionID",
      type : "A_ARG_TYPE_ConnectionID"
    } ], [ {
      name : "RcsID",
      type : "A_ARG_TYPE_RcsID"
    }, {
      name : "AVTransportID",
      type : "A_ARG_TYPE_AVTransportID"
    }, {
      name : "ProtocolInfo",
      type : "A_ARG_TYPE_ProtocolInfo"
    }, {
      name : "PeerConnectionManager",
      type : "A_ARG_TYPE_ConnectionManager"
    }, {
      name : "PeerConnectionID",
      type : "A_ARG_TYPE_ConnectionID"
    }, {
      name : "Direction",
      type : "A_ARG_TYPE_Direction"
    }, {
      name : "Status",
      type : "A_ARG_TYPE_ConnectionStatus"
    } ]);
    this.addAction("GetProtocolInfo", [], [ {
      name : "Source",
      type : "SourceProtocolInfo"
    }, {
      name : "Sink",
      type : "SinkProtocolInfo"
  } ]);

  this.addType("A_ARG_TYPE_ProtocolInfo", "string");

  this.addType("A_ARG_TYPE_ConnectionStatus", "string", "Unknown", [ "OK",
      "ContentFormatMismatch", "InsufficientBandwidth", "UnreliableChannel",
      "Unknown" ]);

  this.addType("A_ARG_TYPE_AVTransportID", "i4", 0);

  this.addType("A_ARG_TYPE_RcsID", "i4", 0);

  this.addType("A_ARG_TYPE_ConnectionID", "i4", 0);

  this.addType("A_ARG_TYPE_ConnectionManager", "string");

  this.addType("A_ARG_TYPE_Direction", "string", "Output", [ "Input", "Output" ]);

  this.addType("SourceProtocolInfo", "string", "", [], null, true);
  this.addType("SinkProtocolInfo", "string", "", [], null, true);
  this.addType("CurrentConnectionIDs",  "string", "0", [], null, true);

  var self = this;

};

ConnectionManagerService.prototype.addProtocolInfo = function(transport, mime, dlna_pn){
  //  "http-get", "*", "mime", "DLNA.ORG_PN=*"

}


Util.inherits(ConnectionManagerService, Service);

module.exports = ConnectionManagerService;
