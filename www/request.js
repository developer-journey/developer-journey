/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";
(function() {
  if (window.request) {
    console.log("Redundant load of request.js ignored");
    return;
  }

  /*
   * Async resource GET
   *
   * path: path to a file on the domain serving this script
   * callback: function with signature function(error, xhr)
   *
   */
  function request(path, callback, headers, method, params) {
    var xhr = new XMLHttpRequest();
    method = method || 'GET';
    if (callback) {
      xhr.ontimeout = function() {
        callback("Request timed out for path " + path, xhr);
      };

      xhr.onreadystatechange = function() {
        if (this.readyState != 4) {
          return;
        }

        if (this.status >= 400) {
          return callback(this.responseText, this);
        }

        if (this.status == 200) {
          return callback(undefined, this);
        }
      };

      xhr.onerror = function(err) {
        callback(
          "Unable to load request. This can occur if you try and REFRESH the authentication page.",
          this);
      }
    }

    xhr.open(method, path, true);

    var hasType = false;
    if (headers && typeof headers === 'object') {
      Array.prototype.forEach.call(Object.getOwnPropertyNames(headers), function(header) {
        if (/content-type/i.exec(header)) {
          hasType = headers[header];
        }
        xhr.setRequestHeader(header, headers[header]);
      });
    }

    if (params && typeof params === 'object') {
      if (!hasType) {
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      }
      params = JSON.stringify(params);
    }

    xhr.send(params);
  }

  var exports = {
    request: request
  };

  Object.getOwnPropertyNames(exports).forEach(function(name) {
    window[name] = exports[name];
  });
})();
