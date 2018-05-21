/*
Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0
*/
"use strict";

const fs = require('fs');

require("./promise"); /* polyfill Promise.map */

let config = null;

var Session = function(id) {
  this.user = null;
  this.created = 0;
  this.authentication = null;
  if (id != null) {
    let session = null;
    try {
      session = JSON.parse(fs.readFileSync(config.sessionDir + id));
      this.id = id;
    } catch (err) {
      this.id = require('crypto').randomBytes(16).toString('hex');
      console.log('Error reading session ' + id + ':');
      console.log(err.message);
    }

    if (session) {
      this.created = session.created;
      this.user = session.user;
      this.authentication = session.authentication || null;
    } else {
      this.created = Date.now();
      this.write();
    }
  } else {
    this.id = require('crypto').randomBytes(16).toString('hex');
    this.created = Date.now();
    this.write();
  }
};

Session.prototype.write = function() {
  try {
    let oldmask = process.umask(0o077);
    fs.mkdirSync(config.sessionDir);
    console.log('Created sessions directory.');
    process.umask(oldmask);
  } catch (err) {
  }

  try {
    console.log('Writing ' + this.id);
    let oldmask = process.umask(0o177);
    /* Make sure the file is only readable by the current user */
    fs.writeFileSync(config.sessionDir + this.id, JSON.stringify({
      created: this.created,
      user: this.user,
      authentication: this.authentication
    }), {
      encoding: 'utf8'
    });
    process.umask(oldmask);
  } catch (err) {
    throw "Unable to write session: " + err.message;
  }
};

function houseKeeping() {
  /* Once every 24 hours, run the houseKeeping */
  setTimeout(houseKeeping, 24 * 60 * 60 * 1000);

  fs.readdir(config.sessionDir, function(err, files) {
    if (err) {
      return;
    }

    Promise.map(files, function(file) {
      return new Promise(function(resolve, reject) {
        fs.stat(config.sessionDir + "/" + file, function(err, stats) {
          if (err) {
            let message = "Error: " + file;
            console.error(message);
            return reject(message);
          }

          /* Two weeks old... nuke it */
          stats.mtime.setDate(stats.mtime.getDate() + 10);
          if (stats.isFile() && stats.mtime < new Date()) {
            console.log("Removing stale session: " + file);
            fs.unlink(config.sessionDir + "/" + file);
          }

          return resolve();
        });
      });
    });
  });
}

module.exports = function(_config) {
  if (!_config) {
    throw "config must be set";
  }
  if (!_config.sessionDir) {
    throw "config.sessionDir must be set";
  }
  config = _config;

  houseKeeping();

  return Session;
};
