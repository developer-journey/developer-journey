/*
Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0
*/
"use strict";

const GitLab = require("./gitlab"),
  parseFrontMatter = require("../www/elements/journey-frontmatter/journey-parse");

function parseJourneyProjectFile(project, file) {
  let meta = {};

  return gitlab.anonymous(
    "/projects/" + project.id +
    "/repository/files/?ref=master&file_path=" + file.name).then((info) => {

    meta.info = info;

    /* Lookup info on when the file was last edited */
    return gitlab.anonymous(
        "/projects/" + project.id + "/repository/commits/" + info.last_commit_id).then((commit) => {
      meta.commit = commit;
    }).catch(function(error) {
      console.warn("Error requesting commits: /projects/" + project.id +
                   "/repository/commits/" + info.last_commit_id);
      console.error(error);

      return Promise.reject(error);
    });

  }).catch(function(error) {
    let statusCode = parseInt(error);
    console.warn("Error requesting file (" + file.name + "): " + error);
    console.error(error);
    if (statusCode > 400 && statusCode < 500) {
      console.warn("Verify anonymousPrivateToken is a valid user token in " +
                   "node-dj.json for server: " + config.gitlabUrl);
    }

    return Promise.reject(error);
  }).then(() => {
    /* The front-end needs the title, summary, etc. which is
     * extracted from the markdown itself.
     *
     * NOTE: GitLab returns the content base64 encoded */
    let content = new Buffer(meta.info.content, "base64").toString("ascii");
    meta.parsed = parseFrontMatter(content);
    if (meta.parsed) {
      console.log("Front-matter found for " + project.name_with_namespace + " / " + file.name);
    } else {
      meta.parsed = {
        content: content
      };
    }

    if (!meta.parsed.title) {
      /* No front-matter found; parse markdown for title */
      let lines = meta.parsed.content.split("\n");
      for (var i = 0; i < lines.length; i++) {
        if (lines[0].trim() == "") {
          continue;
        }
        let parts = /^#+\s*(.*)$/.exec(lines[i]);
        if (parts) {
          meta.parsed.title = parts[1];
        }
        break;
      }

      if (!meta.parsed.title) {
        meta.parsed.title = file.name;
      }
    }

    meta.parsed.author = meta.parsed.author || meta.commit.author_name || meta.commit.commiter_name;

    /* Don't keep around the full contents of the file in the journey object */
    delete meta.info.content;
    if (meta.parsed.content) {
      delete meta.parsed.content;
    }

    return meta;
  });
}

function parseJourneyProject(project) {
  return gitlab.anonymous("/projects/" + project.id + "/repository/tree?recursive=true").then((files) => {
    if (!files || files.length == 0) {
      console.log("No files yet for journey: " + project.name);
      project.files = [];
      return;
    }

    for (var i = 0; i < files.length; i++) {
      if (files[i].type == "tree" && files[i].name == "assets") {
        project.hasAssets = true;
      }
    }

    /* Only process blob files, non-hidden (.*), and not readme[.md] */
    let entries = files.filter(function(item) {
      if (item.type == "blob" && /^cover.(png|jpg|gif|jpeg|svg)$/i.exec(item.name)) {
        project.hasCover = true;
      }

      return (item.type == "blob" &&
              !item.path.match(/\//) &&            /* non-root files */
              !item.name.match(/^\..*/) &&         /* "hidden" files */
              !item.name.match(/^info\.json/) &&   /* meta data */
              !item.name.match(/readme(\.md)?/i)); /* readme file */
    });

    let projectFiles = [];
    return Promise.map(entries, (entry) => {
      console.log("Looking up: " + project.name_with_namespace + " / " + entry.name);
      return parseJourneyProjectFile(project, entry).then(function(meta) {
        projectFiles.push(Object.assign(entry, meta));
      }).catch(function(error) {
        console.warn("Unable to get data for " + file.name);
        console.error(error);
      });
    }, { concurrency: 1 }).then(function() {
      project.files = projectFiles;
    });
  }).catch(function(error) { /* GET tree failed */
    let statusCode = parseInt(error);
    if (statusCode == error) {
      if (statusCode == 404) {
        /* DO NOT reject the promise for 404 */
        console.log("No tree yet for journey: " + project.name);
        return;
      }
      if (statusCode == 403) {
        [ "Access is forbidden to  '" + project.name + "'.",
          "Make sure the anonymous user (" + config.anonymousUser + ")",
          "is at least a Guest member of the group '" + config.groupName + "'",
          "and that the project '" + project.name + "' is not marked as PRIVATE"
        ].forEach(function(line) {
          console.warn(line);
        });
        return;
      }
    }

    console.warn("Error requesting project: /projects/" +
                  project.name + "(" + project.id + ")/repository/tree");
    console.warn("Error: " + JSON.stringify(error, null, 2));
    return Promise.reject(new Error(error));
  });
}

let config, gitlab;
module.exports = function(_config, _gitlab) {
  config = _config;
  gitlab = _gitlab;
  return {
    parseJourneyProject: parseJourneyProject,
    parseJourneyProjectFile: parseJourneyProjectFile
  };
};
