/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const crypto = require('crypto');

let jp = null;

let hookCache = [];

function handleGitLabHook(req, res/*, next*/) {
  let hook = req.body, journeyList = req.journeyList, re;

  /* Expire old cached hooks */
  hookCache = hookCache.filter(function(entry) {
    let timestamp = Date.now();
    return (entry.timestamp + 60 * 1000 > timestamp);
  });

  /* Not looking for crypto security; just reducing processing overhead
   * of handling the same System wide hook **and** a Project level hook
   * within a short period of time */
  let hookSha = crypto.createHash('sha1').update(JSON.stringify(hook)).digest('hex');
  for (let i = 0; i < hookCache.length; i++) {
    if (hookCache[i].sha == hookSha) {
      return res.send("Hook replay; ignoring.");
    }
  }

  /* Add an entry to the cache to check for replays within the next 60s */
  hookCache.push({
    sha: hookSha,
    timestamp: Date.now()
  });

  console.log("Hook received:\n" + JSON.stringify(hook, null, 2));

  /* Process PROJECT level hooks */
  if (hook.object_kind && hook.object_kind == 'push') {
    console.log("Project level hook");
    return journeyList.then(function(journeys) {
      for (let i = 0; i < journeys.length; i++) {
        if (journeys[i].id == hook.project_id) {
          console.log('Push received on tracked Journey.');
          console.log("Re-parse journey");

          /* This will fire asynchronously; we don't block
           * however as the original request from GitLab might
           * timeout if we do. */
          jp.parseJourneyProject(journeys[i]).then(function() {
            console.log("Finished parsing project item");
          }).catch(function(error) {
            console.error("Error while parsing project", error);
          });

          return res.send("Hook processed.");
        }
      }

      console.log('Push received on untracked Journey.');

      return res.send("Hook received for untracked Journey.");
    }).catch(function(error) {
      console.error(error);
    });
  }

  switch (hook.event_name) {
  case "project_create":
    re = new RegExp('^' + req.config.groupName + '\/');
    if ('path_with_namespace' in hook && hook.path_with_namespace.match(re)) {
      console.log('Journey created.');
      console.warn("TODO: Scan **just** new Journey and add to journeyList");
      //req.app.get("generateJourneys")();
    }
    break;

  case "project_rename":
    re = new RegExp('^' + req.config.groupName + '\/');
    if (hook.old_path_with_namespace.match(re)) {
      console.log('Journey renamed.');
      console.warn("TODO: Rename existing journey in journeyList");
      //req.app.get("generateJourneys")();
    }
    break;

  case "project_destroy":
    re = new RegExp('^' + req.config.groupName + '\/');
    if (hook.path_with_namespace.match(re)) {
      console.log('Journey destroyed.');
      journeyList.then(function(journeys) {
        for (let i = 0; i < journeys.length; i++) {
          if (journeys[i].name == hook.name) {
            journeys.splice(i, 1);
            return 1;
          }
        }

        return 0;
      }).then(function(removed) {
        if (removed) {
          console.log("Journey removed from tracked list.");
        }
      });
    }
    break;

  case "user_create":
    /* https://docs.gitlab.com/ce/system_hooks/system_hooks.html */
    console.log('User created.');
    req.gitlab.userCreate(hook.username);
    break;

  case "user_destroy":
    console.log('User destroyed.');
    req.gitlab.userDestroy(hook.username);
    break;

  default:
    console.log("Unprocessed hook: " + hook.event_name);
    break;
  }

  return res.send("Hook processed.");
}

let config, gitlab;
module.exports = function(_config, _gitlab) {
  config = _config;
  gitlab = _gitlab;
  jp = require("../journey-process")(config, gitlab);

  return handleGitLabHook;
};
