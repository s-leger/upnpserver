/*jslint node: true */
"use strict";

var Util = require('util');

var Service = require("./service");

var MediaReceiverRegistrar = function() {
  Service.call(this, {
    serviceType :"urn:microsoft.com:service:X_MS_MediaReceiverRegistrar:1",
    serviceId :  "urn:microsoft.com:serviceId:X_MS_MediaReceiverRegistrar",
    scpdURL :    "/service/mediareceiverregistar/description.xml",
    controlURL : "/service/mediareceiverregistar/control",
    eventSubURL :"/service/mediareceiverregistar/event"
  });

  this.addAction("IsAuthorized", [ {
    name : "DeviceID",
    type : "A_ARG_TYPE_DeviceID"
  } ], [ {
    name : "Result",
    type : "A_ARG_TYPE_Result"
  } ]);
  this.addAction("IsValidated", [ {
    name : "DeviceID",
    type : "A_ARG_TYPE_DeviceID"
  } ], [ {
    name : "Result",
    type : "A_ARG_TYPE_Result"
  } ]);
  this.addAction("RegisterDevice", [ {
    name : "RegistrationReqMsg",
    type : "A_ARG_TYPE_RegistrationReqMsg"
  } ], [ {
    name : "RegistrationRespMsg",
    type : "A_ARG_TYPE_RegistrationRespMsg"
  } ]);

  this.addType("A_ARG_TYPE_DeviceID", "string");
  this.addType("A_ARG_TYPE_RegistrationReqMsg", "bin.base64");
  this.addType("A_ARG_TYPE_RegistrationRespMsg", "bin.base64");
  this.addType("A_ARG_TYPE_Result", "int", 1);
  this.addType("AuthorizationDeniedUpdateID", "ui4", 1, [], "urn:schemas-microsoft-com:datatypes", true);
  this.addType("AuthorizationGrantedUpdateID", "ui4", 1, [], "urn:schemas-microsoft-com:datatypes", true);
  this.addType("ValidationRevokedUpdateID", "ui4", 1, [], "urn:schemas-microsoft-com:datatypes", true)
  this.addType("ValidationSucceededUpdateID", "ui4", 1, [], "urn:schemas-microsoft-com:datatypes", true);

};

Util.inherits(MediaReceiverRegistrar, Service);

module.exports = MediaReceiverRegistrar;

MediaReceiverRegistrar.prototype.processSoap_RegisterDevice = function(xml,
    request, response, callback) {

  return callback();
};

MediaReceiverRegistrar.prototype.processSoap_IsAuthorized = function(xml,
    request, response, callback) {

  var deviceID = Service._childNamed(xml, "DeviceID");

  console.log("IsAuthorized('" + deviceID + "')");

  this.responseSoap(response, "IsAuthorized", {
    _name : "u:IsAuthorizedResponse",
    _attrs : {
      "xmlns:u" : this.type
    },
    _content : {
      Result : {
        _attrs : {
          "xmlns:dt" : "urn:schemas-microsoft-com:datatypes",
          "dt:dt" : "int"
        },
        _content : this.stateVars["A_ARG_TYPE_Result"].get()
      }
    }
  }, callback);
};

MediaReceiverRegistrar.prototype.processSoap_IsValidated = function(xml,
    request, response, callback) {

  var deviceID = Service._childNamed(xml, "DeviceID");

  console.log("IsValidated('" + deviceID + "')");

  this.responseSoap(response, "IsValidated", {
    _name : "u:IsValidatedResponse",
    _attrs : {
      "xmlns:u" : this.type
    },
    _content : {
      Result : {
        _attrs : {
          "xmlns:dt" : "urn:schemas-microsoft-com:datatypes",
          "dt:dt" : "int"
        },
        _content : this.stateVars["A_ARG_TYPE_Result"].get()
      }
    }
  }, callback);
};
