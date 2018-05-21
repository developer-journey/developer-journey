/*
Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0
*/
"use strict";

module.exports = function(gitlab, config) {
  return gitlab.anonymous("/groups/" + config.groupName).then((group) => {
    return group.projects;
  }).catch((error) => {
    /* Display some useful error log information if the /groups request
     * failed, then reject the promise */
    let statusCode = parseInt(error);
    if (statusCode == error) {
      console.warn("Unable to request group: " + statusCode);
      if (statusCode == 404) {
        console.warn("Verify group '" + config.groupName + "' exists (specified in node-dj.json via groupName)");
      } else if (statusCode > 400 && statusCode < 500) {
        console.warn("Verify anonymousPrivateToken is a valid user token in node-dj.json for server: " + config.gitlabUrl);
      }
    } else {
      console.warn(error);
    }
    throw new Error("Unable to request group: " + error);
  });
}
