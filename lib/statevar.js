var debug = require("debug")("upnpserver:statevar:event")

/***
 * StateVar : implements evented and moderated stateVars getters and setters.
 *
 * @service  : service, the service instance this var belongs to
 * @name     : string,   name of the state variable
 * @value    : mixed,    default value of the variable
 * @ns       : string,   xmlns:dt for vendor variable
 * @evented  : boolean,  send event on change
 * @moderation_rate : float,           minimum delay in second allowed between
                                      two events, enable moderation when set
 * @additionalProps : array of string, statevar name to be sent with this event
                                      (not realy in specs, allow event grouping)
 * @pre/post EventCb : function,       callback executed before / after sending event
 *
 */

var StateVar = module.exports =  function(service, name, type, value, ns, evented,
  moderation_rate, additionalProps, preEventCb, postEventCb){

  var self = this;

  if (value != undefined ){
    self.value = value;
  }
  else {
    switch (type){
      case "boolean":
      case "iu4":
        self.value = 0;
      break;
      case "string":
      default:
        self.value = "";
    };
  }

  self.name     = name;
  self.ns       = ns;
  self.type     = type;
  self.service  = service;

  self.additionalProps  = additionalProps || [];
  self.postEventCb      = postEventCb;
  self.preEventCb       = preEventCb;

  // implements set method
  self.set =
    evented && moderation_rate ? function(val){var old = self.value; self.value = val; if (old !== val) self.moderate()}
    : evented ? function(val){var old = self.value; self.value = val; if (old !== val) self.notify()}
    : function(val){self.value = val};

  self.rate = moderation_rate && 1000*moderation_rate;
  self.next = moderation_rate && new Date().getTime();
  self.wait = false;
}

StateVar.prototype.get = function(){
  return this.value;
}

StateVar.prototype.notify = function(){
  var self = this;
  debug("notify "+this.name);
  if (self.preEventCb) self.preEventCb();
  var props = {};
  self.additionalProps.forEach(function(name){
    props[name] = {
      value:self.service.stateVars[name].get(),
      type:self.service.stateVars[name].type,
      ns:self.service.stateVars[name].ns
    }
  });
  props[self.name] = {
    value:self.get(),
    type:self.type,
    ns:self.ns
  }
  self.service.makeEvent(props);
  if (self.postEventCb) self.postEventCb();
}

StateVar.prototype.moderate = function(){
  var self = this;
  var now = new Date().getTime();
  if (now > self.next) {
    debug("emit moderate "+this.name);
    self.next = new Date().getTime() + self.rate;
    self.notify();
    setTimeout(function(){
      debug("stop moderate "+self.name);
      self.wait = false;
    },self.rate);
    self.wait = true;
  } else {
    if (self.wait) return;
    debug("start moderate "+this.name);
    self.next = new Date().getTime() + self.rate;
    self.notify();
    self.wait = true;
  }
}
