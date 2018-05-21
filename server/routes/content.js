/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const express = require('express'),
  router = express.Router();

/* Given an arbitrary path, parse it into the following chunks:
 *
 * [/USER]/JOURNEY[/PAGE|/assets/RESOURCE]
 *
 * NOTE: parseParts could possibly be rewritten as a chain of middleware
 * that pulls the parameters off the route and passes to the next
 * middleware chain. The function was inherited from some non-Express code
 * and "if it isn't broken, don't fix it."
 *
 * NOTE 2: User can not be 'image', 'view', 'edit', or 'journeys'.
 *
 * NOTE 3: If supplied, the 'user' must exist or the path is invalid.
 */
function parseParts(req, path) {
  let config = req.config;

  return new Promise(function(resolve, reject) {
    let matches = /^\/([^/]*)?(\/([^/]*))?(\/([^/]*))?(\/([^/].*))?$/.exec(path);
    if (!matches) {
      return reject('regexp fail: ' + path);
    }

    var fields = matches.length - 1;
    while (matches[fields--] == null);

//    console.log('Fields: ' + fields, JSON.stringify(matches, null, '\t'));

    var results = {
      matches: matches,
      user: config.groupName,
      page: 'recipe',
      resource: '',
      journey: '',
      args: matches[7]
    };

    switch (fields) {
    case 0: /* journey */
      console.log('journey');
      results.journey = matches[1];
      return resolve(results);

    case 2: /* journey + page, or user + journey */
      /* Check if matches[1] is a user */
      return req.gitlab.findUser(matches[1]).then(function(username) {
        if (0 && username) {
          console.log('user + journey');
          results.user = username;
          results.journey = matches[3];
        } else {
          console.log('journey + page');
          /* No user matched; this is a journey + page */
          results.journey = matches[1];
          results.page = matches[3];
        }

        return resolve(results);
      });

    case 4: /* user + journey + page, journey + 'assets' + resource */
      if (matches[3] == 'assets') {
        console.log('journey + "assets" + resource');
        results.journey = matches[1];
        results.resource = matches[5];
        return resolve(results);
      }

      return req.gitlab.findUser(matches[1]).then(function(username) {
        console.log('user + journey + page');
        results.user = username;
        results.journey = matches[3];
        results.page = matches[5];
        return resolve(results);
      });

    case 5: /* Invalid path */
      return resolve(null);

    case 6: /* user + journey + 'assets' + resource, journey + page + 'assets' + resource */
      if (matches[5] != 'assets') {
        return resolve(null);
      }

      return req.gitlab.findUser(matches[1]).then(function(username) {
        if (username) {
          console.log('user + journey + "assets" + resource');
          results.user = username;
          results.journey = matches[3];
          results.resource = matches[7];
        } else {
          console.log('journey + page + "assets" + resource');
          results.journey = matches[1];
          results.page = matches[3];
          results.resource = matches[7];
        }

        return resolve(results);
      });

    default:
      console.warn("Unable to split URL into journey parts.");
      return resolve(null);
    }
  });
}

function requestToGitPath(req) {
  /* Pull of any GET parameters before processing the path */
  return parseParts(req, req.url.replace(/\?.*/, "")).then(function(object) {
/*  console.log(JSON.stringify(object, null, 2));
    console.log('user: ' + object.user);
    console.log('journey: ' + object.journey);
    console.log('page: ' + object.page);
    console.log('args: ' + object.args);
    console.log('resource: ' + object.resource);
*/
    if (object.resource != '') {
      //res.mimeType = mime.lookup(object.resource);
      object.path = "assets%2f" + object.resource;
    } else {
      object.path = object.page;
    }
    return object;
  });
}

router.get("/images/*", function(req, res, next) {
  console.log("GET /content/images/" + req.url);
  return res.status(200).send("[]");
});

router.put("/images/*", function(req, res, next) {
  console.log("PUT /content/images/" + req.url);
  return res.status(200).send("[]");
});

router.delete("/images/*", function(req, res, next) {
  console.log("DELETE /content/images/" + req.url);
  return res.status(200).send("[]");
});

router.post("/images/*", function(req, res, next) {
  console.log("POST /content/images/" + req.url);
  return res.status(200).send("[]");
});

router.get("/*", function(req, res, next) {
  return requestToGitPath(req).then(function(object) {
    let gitPath = "/projects/" + object.user + "%2f" + object.journey +
       "/repository/";

    if (object.page == "assets") {
      gitPath += "tree?path=assets&per_page=200&page=1";
    } else {
      gitPath += "files?ref=master&file_path=" + object.path;
    }

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
    });
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

router.put("/*", function(req, res, next) {
  return putOrPost("PUT", req, res, next);
});

router.post("/*", function(req, res, next) {
  return putOrPost("POST", req, res, next);
});

function putOrPost(method, req, res, next) {
  return requestToGitPath(req).then(function(object) {
    let gitPath = "/projects/" + object.user + "%2f" + object.journey +
       "/repository/files/" + object.path;

    let params = {
      branch: "master",
      file_path: object.path
    };

    if (req.is() == "text/plain") {
      params.commit_message = "Web commit at " + new Date().toISOString();
      params.content = req.text;
    } else {
      let command = req.body;
      params.encoding = command.encoding;
      params.commit_message = command.message;
      params.content = command.content;
    }

    let gitFunction;
    if (req.session.authentication) {
        gitFunction = req.gitlab.user(req.session, gitPath, method, params);
    } else {
        gitFunction = req.gitlab.anonymous(gitPath, method, params);
    }

    return gitFunction.then(function(data) {
      return res.status(200).send(data);
    });
  }).catch(function(error) {
    let statusCode = parseInt(error);
    if (statusCode == error) {
      console.error("Error", statusCode);
      return res.status(statusCode).json({
        message: "Unable to write resource.",
        status: statusCode
      });
    }
    console.error("Error", error);
    return res.status(500).json({
      message: "Internal error",
      status: 500
    });
  });
}

let config, gitlab;
module.exports = function(_config, _gitlab) {
  config = _config;
  gitlab = _gitlab;
  return router;
};
