/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const express = require('express'),
  fs = require('fs'),
  request = require('request');

const router = express.Router();

router.get('/logout', function(req, res/*, next*/) {
  let session = req.session, config = req.config;

  res.clearCookie("dj-session");

  if (!session || !session.authentication) {
    return res.status(403).send("Forbidden");
  }

  /* Null out the session token on disk */
  var access_token = session.authentication.access_token;
  session.user = null;
  session.authentication = null;
  session.write();
  res.status(200).send({ authorization: null});

  request({
    url: config.gitlabUrl + '/oauth/revoke?token=' + access_token,
    headers: {
      'Authorization': 'Bearer ' + access_token
    },
    method: 'POST'
  }, function (error, data/*, body*/) {
    if (!error && data.statusCode === 200) {
      console.log('Token revoked per user request.');
    } else {
      console.log('Error revoking token: ' + error.message);
    }
  });
});

router.get('/check', function(req, res/*, next*/) {
  let session = req.session;

  if (session.authentication && session.user) {
    console.log('authenticate/check: ' + session.user.username);
    return res.status(200).send(session.user);
  }

  console.log('authenticate/check: INACTIVE');
  return res.status(200).send({ status: "inactive" });
});

router.get('/:code?', function(req, res/*, next*/) {
  let config = req.config, session = req.session;

  if (!req.params.code) {
    console.log('authenticate');
    const index = fs.readFileSync(req.config.docRoot + 'authenticate.html', 'utf8').replace(
      /<script>'<base href="BASEPATH">';<\/script>/,
      "<base href='" + req.config.basePath + "'>");
    return res.status(200).send(index);
  }

  console.log('authenticate/' + req.params.code);

  res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');

  /* NOTE: This needs to be a POST or GitLab's doorkeeper won't receive it */
  request({
      url: config.gitlabUrl + '/oauth/token' +
          '?grant_type=authorization_code' +
          '&code=' + req.params.code +
          '&redirect_uri=' + config.redirectUrl +
          '&client_id=' + config.applicationId +
          '&client_secret=' + config.secret,
      method: 'POST'
  }, function (error, data, body) {
    if (error) {
      console.log("Error invoking oauth/token to get an authorization_code");
      console.warn(error);
      return res.status(500).send("Error connecting to GitLab");
    }

    if (data.statusCode !== 200) {
      console.log("Errant status code returned while invoking oauth/token to get an authorization_code: " + data.statusCode);
      return res.status(500).send();
    }

    session.authentication = JSON.parse(body);
    session.write();

    console.log('Requesting user info for: ' + session.authentication.access_token);

    request({
      url: config.gitlabUrl + '/api/v3/user',
      headers: {
        'Authorization': 'Bearer ' + session.authentication.access_token
      }
    }, function (error, data, body) {
      if (error) {
        console.log("Error getting user information");
        console.warn(error);
        res.status(403).send(error.message);
      }

      if (data.statusCode !== 200) {
        console.log("Errant status code returned while getting user information: " + data.statusCode);
        return res.status(200).send(session.user);
      }

      if (!session.authentication) {
        console.error('Unable to authenticate session in progress.');
        return res.status(503).send("Trainwreck! Deauthentication occurred during authentication!");
      }

      session.user = JSON.parse(body);
      session.user.access_token = session.authentication.access_token;
      session.write();
      return res.status(200).send(session.user);
    });
  });
});

let config, gitlab;
module.exports = function(_config, _gitlab) {
  config = _config;
  gitlab = _gitlab;
  return router;
};
