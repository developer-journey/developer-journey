/*
 * Copyright (c) 2016-2018, Intel Corporation.
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const express = require('express'),
  fs = require('fs'),
  child_process = require('child_process'),
  path = require('path'),
  root = path.dirname(require.main.filename) + "/..",
  crypto = require('crypto'),
  bufferCompare = require('buffer-equal-constant-time');

const router = express.Router();

const isGitLab = true;

function execSync(res, hook) {
  let args = [
    "-u", "ght",
    "-H", path.join(root, 'sync')
  ];

  /* Arguments to the `sync` script are PROJECT-NAME BRANCH COMMITTER-NAME COMMIT-SHA */
  let parameters;
  if (isGitLab) {
    parameters = [
      hook.project.name,
      hook.ref,
      hook.user_name,
      hook.checkout_sha
    ];
  } else {
    parameters = [
      hook.repository.full_name,
      hook.ref,
      hook.pusher.name,
      hook.head_commit.id
    ];
  }

  args = args.concat(parameters);

  console.log("Executing: sudo " + args.join(" "));

  res.status(200).send("WebHook processed. Check update.log for details.");

  child_process.execFile("sudo", args, { cwd: root }, function (error/*, stdout, stderr*/) {
    if (error) {
      console.log("Unable to update via sync: " + error);
      return;
    }
  });
}

router.get('/', function(req, res/*, next*/) {
  try {
    res.send(fs.readFileSync('version.json'));
  } catch (___) {
    res.send({});
  }
});

function computeSignature(key, data) {
  return 'sha1=' + crypto.createHmac('sha1', key).update(data).digest('hex');
}

router.post('/', function(req, res/*, next*/) {
  const event = req.get(isGitLab ? 'X-Gitlab-Event' : 'X-GitHub-Event');

  if ((isGitLab && event != 'Push Hook') || (!isGitLab && event != 'push')) {
    console.log('WebHook fired for non push event: ' + event);
    return res.status(400).send("Invalid event type.");
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.log('WEBHOOK_SECRET not set in environment. Dynamic update disabled.');
    return res.status(500).send("System not configured for secure Webhook.");
  }

  /* GitLab just provides the WEBHOOK_SECRET in clear text; GitHub provides
   * a computed signature of the body using the secret */

  /* For GitHub, verify that the inbound Webhook signature was computed using
   * the WEBHOOK_SECRET secret
   */
  if (!isGitLab) {
    const signature = req.get('X-Hub-Signature');
    if (!signature) {
      console.log('Signature missing.');
      return res.status(401).send("Unauthorized: Missing or invalid signature.");
    }

    const computedSignature = computeSignature(secret, req.rawBody);
    if (!bufferCompare(new Buffer(signature), new Buffer(computedSignature))) {
      console.log('Signature does not match.');
      return res.status(401).send("Unauthorized: Invalid signature.");
    }
  } else {
    const token = req.get('X-Gitlab-Token');
    if (!token) {
      console.log('WebHook secret missing.');
      return res.status(401).send("Unauthorized: Missing or invalid secret.");
    }

    if (secret != token) {
      console.log('Token does not match.');
      return res.status(401).send("Unauthorized: Invalid token.");
    }
  }

  var hook;
  try {
      hook = req.body;
  } catch (err) {
    console.warn('Error parsing WebHook: ' + JSON.stringify(err));
    res.status(400).send("Invalid hook received.");
    return;
  }

  execSync(res, hook);
});

let config, gitlab;
module.exports = function(_config, _gitlab) {
  config = _config;
  gitlab = _gitlab;
  return router;
};
