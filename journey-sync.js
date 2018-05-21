/* Stand alone utility to pull all projects from groupName and sync them
 * into a read-only directory under 'journeys/' */

/*
Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0
*/

"use strict";

const GitLab = require("./server/gitlab"),
  config = require("./server/journey-config"),
  Session = require("./server/session")(config),
  getGroupProjects = require("./server/journey-group"),
  fs = require("fs");

try {
  Promise = require("bluebird");
} catch(_) {
}

require("./server/promise.js"); /* Promise polyfill to provide some bluebird like features */

require("./server/console-line.js"); /* Monkey-patch console.log with line numbers */

/* Turn off rejection of invalid certificates */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

process.on('unhandledRejection', (reason, p) => {
  console.error("Unhandled Rejection at: Promise", p, 'reason:', reason);
});

const gitlab = new GitLab({
  gitlabUrl: config.gitlabUrl,
  groupPrivateToken: config.groupPrivateToken,
  anonymousPrivateToken: config.anonymousPrivateToken
});

function syncBlob(project, blob) {
  let gitPath = "/projects/" + config.groupName + "%2f" + project.name +
     "/repository/files?ref=master&file_path=" + blob.path.replace(/\//g, "%2f");

  return gitlab.anonymous(gitPath).then((data) => {
    return new Promise((resolve, reject) => {
      fs.writeFile("journeys/" + project.name + "/" + blob.path, data.content, {
          encoding: data.encoding
        }, (err) => {
        if (err) {
          return reject("writeFile failed: " + JSON.stringify(err, null, 2));
        }
        return resolve(1);
      });
    });
  }).catch((err) => {
    console.error("Unable to fetch: " + gitPath);
    console.error("Reason: " + err);
    return 0;
  });
}

function createPath(path) {
  let parts = path.split("/");
  path = "";
  return Promise.mapSeries(parts, (part) => {
    path += path ? ("/" + part) : part;
    return new Promise(function(resolve, reject) {
      fs.stat(path, (err, stats) => {
        if (err && err.code != "ENOENT") {
          return reject(err);
        }

        if (!err) {
          if (stats.isDirectory()) {
            return resolve();
          }

          return reject(path + " exists and is not a directory.");
        }

        fs.mkdir(path, (err) => {
          if (err) {
            return reject(err);
          }

          return resolve();
        });
      });
    });
  });
}

function syncTree(project) {
  let query = "?recursive=true";

  return gitlab.anonymous(
    "/projects/" + project.id + "/repository/tree" + query)
  .then((entries) => {
    let blobs = [], trees = [], updated = 0;

    if (!entries || entries.length == 0) {
      console.log("No entries for journey: " + project.name);
      return;
    }

    entries.forEach((entry) => {
      switch (entry.type) {
      case "blob":
        blobs.push(entry);
        break;
      case "tree":
        trees.push(entry);
        break;
      }
    });

    /* Create the path */
    return Promise.map(trees, (tree) => {
      return createPath("journeys/" + project.name + "/" + tree.path);
    }, {
      concurrency: 10
    }).then(function() {
      return Promise.map(blobs, (blob) => {
        return syncBlob(project, blob).then((results) => {
          updated += results;
        });
      }, {
        concurrency: 3
      });
    }).then(() => {
      return updated;
    });
  });
}

getGroupProjects(gitlab, config).then((projects) => {
  if (config.ignoreProjects) {
    /* Filter out any projects which should be ignored (they aren't Journeys) */
    projects = projects.filter(function(project) {
      for (let i = 0; i < config.ignoreProjects.length; i++) {
        if (project == config.ignoreProjects[i]) {
          console.log("Ignoring project: " + project);
          return false;
        }
      }
      return true;
    });
  }

  return projects;
}).then((projects) => {
  let journeys = 0, files = 0;

  /* Walk through each project listed in the Group */
  console.log("Processing " + projects.length + " projects.");

  return createPath("journeys").then(() => {
    return Promise.map(projects, (project) => {
      console.log("Processing project " + project.name + ".");

      return createPath("journeys/" + project.name).then(() => {
        return syncTree(project).then((count) => {
          console.log(" * updated " + count + " files in " + project.name);
          files += count;
          journeys++;
        });
      });
    }, {
      concurrency: 1
    }).then(function() {
      return [ journeys, files ];
    });
  });
}).spread((journeys, files) => {
  console.log("Updated " + files + " across " + journeys + " journeys.");
  process.exit(0);
}).catch((err) => {
  throw err;
  process.exit(-1);
});
