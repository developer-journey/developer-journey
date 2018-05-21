/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const express = require('express'),
  fs = require('fs'),
  url = require('url');

const router = express.Router();

router.get("/*", function(req, res/*, next*/) {
  console.log("Page not found: " + req.url);
  return res.status(404).json({
    message: "Page not found",
    status: 404
  });
});

module.exports = router;
