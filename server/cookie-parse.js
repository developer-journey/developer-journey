/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */

/* Minimal cookie header parser; parses req.headers.cookies and creates a
 * req.cookie as a KEY: VALUE map. It does not support signing or anything
 * fancy. */
"use strict";
const cookie = require('cookie');

module.exports = function(req, res, next) {
  /* Already set? Next(). */
  if (req.cookies) {
    return next();
  }

  /* Create an emtpy cookie jar */
  req.cookies = {};

  /* If no headers are set, next() */
  if (!req.headers.cookie) {
    return next();
  }

  try {
    req.cookies = cookie.parse(req.headers.cookie);
  } catch (___) {
    console.error("Unable to parse cookies for " + req.url);
  }

  return next();
};
