/*
 * Copyright (c) 2015-2018, Intel Corporation.
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const request = require('request');

/* Simple Promise wrapper around 'request' used by the GitLab API methods
 *
 * Asumes response is json
 */
function promiseRequest(options) {
  return new Promise(function(resolve, reject) {
    /* Parse return results as JSON */
    if (!("json" in options)) {
      options.json = true;
    }
    request(options, function(error, response, body) {
      if (error) {
        console.warn('Error "' + options.url + '": ' + error.message);
        return reject(new Error(error.message));
      }

      if (response.statusCode >= 400) {
        console.warn("Failure fetching: " + options.url +
          "\n" + JSON.stringify(response.body, null, 2));
        return reject(response.statusCode);
      }

      try {
        switch (response.headers["content-type"]) {
        case "application/json":
          body = typeof body === "object" ? body : JSON.parse(body);
          break;
        }
        return resolve(body);
      } catch (_) {
        console.error(_);
        console.warn("Headers: \n" + JSON.stringify(response.headers, null, 2));
        return reject(new Error("Unable to parse response as JSON"));
      }
    });
  });
}

function GitLab(options) {
  this.options = options;

  console.log('Requesting user list.');
  this.users = this.anonymous('/users').then(function(users) {
    if (!Array.isArray(users)) {
      return Promise.reject(new Error("GET /users did not return an array of users."));
    }
    console.log('User list updated to ' + users.length + ' users.');
    let usernames =[];
    users.forEach(function(user) {
      usernames.push(user.username);
    });

    return Promise.resolve(usernames);
  }).catch(function(error) {
    console.warn("Fetching users failed: " + error);
    let statusCode = parseInt(error);
    if (statusCode == error && statusCode > 400 && statusCode < 500) {
      console.warn("Verify anonymousPrivateToken is a valid user token.");
    }
    return Promise.reject(error);
  });
}

/* NOTE: Do not call this method with any user source data. It operates
* with ownership privileges on the Journeys group */
GitLab.prototype.private = function(api, method, params) {
//  console.log('gitLabPrivate: ' + api);
  return promiseRequest({
    url: this.options.gitlabUrl + '/api/v3' + api,
    json: params,
    headers: {
      'PRIVATE-TOKEN': this.options.groupPrivateToken
    },
    method: method || 'GET'
  });
};

GitLab.prototype.admin = function(adminPrivateKey, api, method, params) {
  console.log('gitLabPrivate (ADMIN): ' + api);
  return promiseRequest({
    url: this.options.gitlabUrl + '/api/v3' + api,
    json: params,
    headers: {
    'PRIVATE-TOKEN': adminPrivateKey
    },
    method: method || 'GET'
  });
};

GitLab.prototype.anonymous = function(api, method, params) {
//  console.log('gitLabAnonymous: ' + api);
  return promiseRequest({
    url: this.options.gitlabUrl + '/api/v3' + api,
    json: params,
    headers: {
      'PRIVATE-TOKEN': this.options.anonymousPrivateToken
    },
    method: method || 'GET'
  });
};

GitLab.prototype.user = function(session, api, method, params) {
  method = method || "GET";
  console.log('API: ' + api);
/*  console.log('Token: ' + session.authentication.access_token); */
  console.log("Method: " + method);

  return promiseRequest({
    url: this.options.gitlabUrl + '/api/v3' + api,
    json: params,
    headers: {
      'Authorization': 'Bearer ' + session.authentication.access_token
    },
    method: method
  });
};

GitLab.prototype.installSystemHook = function(adminPrivateKey, hook) {
  return this.admin(adminPrivateKey, '/hooks', 'GET').then((hooks) => {
    let i;

    for (i = 0; i < hooks.length; i++) {
      if (hooks[i].url === hook) {
        break;
      }
    }

    if (i != hooks.length) {
      console.log('SYSTEM hook is installed and valid:');
      console.log('    ' + hook);
      return Promise.resolve(0);
    }

    console.log('Attempting to install System hook:');
    console.log('    ' + hook);

    return this.admin(adminPrivateKey, '/hooks', 'POST', {
      url: hook,
      enable_ssl_verification: false
    }).then(function(/*response*/) {
      console.log('System hook installed.');
      return Promise.resolve(1);
    }).catch(function(error) {
      console.warn('Unable to install System hook: ' + error);
      return Promise.reject(error);
    });
  });
};

GitLab.prototype.getUsers = function() {
  return this.users;
};

GitLab.prototype.findUser = function(username) {
  return this.users.then(function(usernames) {
    for (var i = 0; i < usernames.length; i++) {
      if (username == usernames[i]) {
        return username;
      }
    }
    return null;
  });
};

GitLab.prototype.userCreate = function(username) {
  return this.users.then(function(usernames) {
    for (let i = 0; i < usernames.length; i++) {
      if (usernames[i] == username) {
        return username;
      }
    }
    usernames.push(username);
    return username;
  });
};

GitLab.prototype.userDestroy = function(username) {
  return this.users.then(function(usernames) {
    for (let i = 0; i < usernames.length; i++) {
      if (usernames[i] == username) {
        usernames.splice(i, 1);
      }
    }
  });
};

module.exports = GitLab;
