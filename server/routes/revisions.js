/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const express = require('express'),
  router = express.Router();

router.get("/:journey/assets/:asset", function(req, res, next) {

});

router.get("/:journey/:article", function(req, res, next) {
  return res.status(200).send([{
    author_name: "jketreno",
    date: (new Date()).toString(),
    message: "Magic 1"
  }, {
    author_name: "jketreno",
    date: (new Date()).toString(),
    message: "Magic 2"
  }]);

  let gitFunction;
  if (req.session.authentication) {
    gitFunction = req.gitlab.user(req.session, gitPath);
  } else {
    gitFunction = req.gitlab.anonymous(gitPath);
  }

  return gitFunction.then(function(data) {
    res.contentType(object.path);
    if (object.page == "assets") {
      var files = [];
      data.forEach(function(entry) {
        files.push(entry.name);
      });
      return res.status(200).send(files);
    } else {
      return res.status(200).send(Buffer.from(data.content, data.encoding));
    }
  }).catch(function(error) {
    let statusCode = parseInt(error);
    if (statusCode == error) {
      console.error("Error", statusCode);
      return res.status(statusCode).json({
        message: "Unable to fetch resource.",
        status: statusCode
      });
    }
    console.error("Error", error);
    return res.status(500).json({
      message: "Internal error",
      status: 500
    });
  });
});

let config, gitlab;
module.exports = function(_config, _gitlab) {
  config = _config;
  gitlab = _gitlab;
  return router;
};
