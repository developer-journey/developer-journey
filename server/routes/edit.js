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
  return res.status(200).send(fs.readFileSync(req.config.docRoot + 'editor.html', 'utf8'));
});

module.exports = router;
