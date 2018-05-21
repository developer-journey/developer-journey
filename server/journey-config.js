/*
Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0
*/
"use strict";

const config = require("./config")("node-dj.json", [
  "gitlabHost", "gitlabPath", "hostUrl",
  "anonymousPrivateToken", "groupPrivateToken",
  "applicationId", "secret"
]);

/* hostUrl should not end in a slash */
config.hostUrl = config.hostUrl.replace(/\/*$/, "");

/* Make sure basePath starts and ends in a slash */
config.basePath = "/" + (process.env.BASE || config.basePath || "").replace(/^\/+|\/+$/g, "") + "/";

/* Make sure sessionDir ends in a slash */
config.sessionDir = config.sessionDir.replace(/\/+$/, "") + "/";

/* Fill optional config fields with defaults */
config.groupName = config.groupName || "journeys";
config.localPort = config.localPort || 8911;
config.gitlabUrl = config.gitlabUrl || (config.gitlabHost + config.gitlabPath);
config.docRoot = (config.docRoot || "./www").replace(/^\/$/, "") + "/";

/* Constructed config paths */
config.djUrl = config.hostUrl + config.basePath;
config.redirectUrl = config.djUrl + "authenticate";
config.hook = config.djUrl + "gitlab-hook";

module.exports = config;
