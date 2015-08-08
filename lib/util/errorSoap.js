/*jslint node: true, plusplus:true, nomen: true, vars: true */
"use strict";

var ERROR_SOAP = {
  401: "Invalid Action",
  402: "Invalid Args",
  404: "Invalid Var",
  501: "Action Failed",
  600: "Argument Value Invalid",
  601: "Argument Value Out of Range",
  602: "Optional Action Not Implemented",
  604: "Human Intervention Required",
  605: "String Argument Too Long",
  701: "No Such Object",
  709: "Invalid Sort Criteria",
  710: "No such container"
}

Error.soap = function(code){
  code = code || 500;
  var msg  = ERROR_SOAP[code] || 'Unknown error';
  var err    = new Error(msg);
  err.code   = code;
  return err;
};
