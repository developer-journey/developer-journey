/*
 * Copyright (c) 2015-2018, Intel Corporation.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * node-dj provides:
 *
 * + A cached view of the top level "global" developer journeys. These
 *   are fully regenerated at application launch and then dynamically updated
 *   based on a system hook to monitor new projects, and project hooks to monitor
 *   new changes within a project. The data is persisted as "journeys.json" on disk.
 *
 * + An OAuth connection between the client applications and the
 *   GitLab instance, internally maintaining the secret Developer Journey application
 *   key used by clients to request access tokens.
 *
 * + An anonymous proxy interface for API requests into GitLab journeys. The
 *   GitLab API can be queried by prefixing using the anonymous/ URI prefix, for example:
 *
 *       https://${HOSTNAME}/developerjourney/anonymous/api/v3/...
 *
 * + For authenticated session connections, the ability to commit Journey content using
 *   that user"s GitLab credentials.
 *
 */
"use strict";

console.log("Starting up Developer Journey server.");

const express = require("express"),
  morgan = require("morgan"),
  bodyParser = require("body-parser"),
  cookieParse = require("./cookie-parse"),
  GitLab = require("./gitlab"),
  config = require("./journey-config"),
  Session = require("./session")(config),
  getGroupProjects = require("./journey-group");

require("./promise.js"); /* Promise polyfill to provide some bluebird like features */
require("./console-line.js"); /* Monkey-patch console.log with line numbers */

const gitlab = new GitLab({
  gitlabUrl: config.gitlabUrl,
  groupPrivateToken: config.groupPrivateToken,
  anonymousPrivateToken: config.anonymousPrivateToken
});

const jp = require("./journey-process")(config, gitlab);

config.journeyList = generateJourneys();

config.journeyList.then(function(journeys) {
  console.log(journeys.length + " journeys indexed.");
}).catch(function(error) {
  console.error("Unable to load journey list: ", error);
  process.exit(-1);
});

const app = express();

/* App is behind an nginx proxy which we trust, so use the remote address
 * set in the headers */
app.set("trust proxy", true);

/* Turn off rejection of invalid certificates */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/* Handle static files first so excessive logging doesn't occur */
app.use(config.basePath, express.static(config.docRoot, { index: false }));

console.log("Base URL path: " + config.basePath);
console.log("Serving from: " + config.docRoot);

app.use(morgan("common"));

/* Inject logged in user name into the log file */
morgan.token('remote-user', function (req, res) {
  if (!req.session) {
    return "N/A";
  }

  let id = req.session.id.substr(0, 8);
  if (req.session.user) {
    return req.session.user.username + ":" + id;
  } else {
    return "(noauth):" + id;
  }
});

/* Copy the raw body before it is processed so
 * GitHub code will work (it requires the unmodified
 * body to compute the signature) */
app.use(bodyParser.json({
  limit: '50mb',
  verify: function(req,res,buf) {
    req.rawBody = buf;
  }
}));

app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: false
}));

/* body-parser does not support text/*, so add support for that here */
app.use(function(req, res, next){
  if (!req.is('text/*')) {
    return next();
  }
  req.setEncoding('utf8');
  let text = '';
  req.on('data', function(chunk) {
    text += chunk;
  });
  req.on('end', function() {
    req.text = text;
    next();
  });
});

app.use(cookieParse);

/* Add some global variables to `req`. These can mostly go away now that we
 * pass the config and gitlab instance to each middleware module when we
 * require() it. */
function bindRequestToConfig(req, res, next) {
  if (req.config) {
    return next();
  }

  [ "config", "gitlab", "journeyList" ].forEach(function(field) {
    for (var key in req) {
      if (field == key) {
        console.warn("request[" + field + "]: ", req[field]);
        throw new Error("Can not overwrite request field: " + field);
      }
    }
  });

  req.config = config;
  req.journeyList = config.journeyList;
  req.gitlab = gitlab;

  return next();
}

/* Injecct some headers into the HTTP request so the frontend can parse
 * them out */
function bindRequestToSession(req, res, next) {
  if (req.config) {
    return next();
  }

  /* Chain into biding the config to the request, then continue
   * binding the session */
  bindRequestToConfig(req, res, function() {});

  [ "session" ].forEach(function(field) {
    for (var key in req) {
      if (field == key) {
        console.warn("request[" + field + "]: ", req[field]);
        throw new Error("Can not overwrite request field: " + field);
      }
    }
  });

  let id = req.cookies ? req.cookies["dj-session"] : null;
  if (id && !/[a-z0-0]+/i.test(id)) {
    console.log("Ignoring dj-session; bad form.");
    id = null;
  }

  req.session = new Session(id);
  if (req.session.id == -1) {
    req.session = new Session();
  }

  res.cookie("dj-session", req.session.id, {
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });

  return next();
}

app.use(config.basePath + "api/v1/config", function(req, res/*, next*/) {
  /* All of the following are public data; no server private keys
   * or tokens can be provided. */
  return res.status(200).json({
    redirectUrl: config.redirectUrl,
    gitlabHost: config.gitlabHost,
    gitlabPath: config.gitlabPath,
    applicationId: config.applicationId,
    groupName: config.groupName,
    djUrl: config.djUrl
  });
});

app.use(config.basePath + "api/v1/content", bindRequestToSession, require("./routes/content")(config, gitlab));
app.use(config.basePath + "api/v1/revisions", bindRequestToSession, require("./routes/revisions")(config, gitlab));
app.use(config.basePath + "gitlab-hook", bindRequestToConfig, require("./routes/gitlab-hook")(config, gitlab));
app.use(config.basePath + "authenticate", bindRequestToSession, require("./routes/authenticate")(config, gitlab));

app.get(config.basePath + "journeys.json", bindRequestToSession, function(req, res/*, next*/) {
  return config.journeyList.then(function(journeys) {
    return res.send(journeys);
  }).catch((error) => {
    return res.status(500).send(error);
  });
});

/* If the following do not exist on disk, they always return index.html */
const index = require("./routes/index")(config, gitlab);
app.use(config.basePath + "users", bindRequestToSession, index);
app.use(config.basePath, bindRequestToSession, index);

/* Declare the "catch all" index route last; the final route is a 404 dynamic router */
app.use(config.basePath, index);

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500).json({
    message: err.message,
    error: {}
  });
});

/**
 * Create HTTP server and listen for new connections
 */
app.set("port", config.localPort);

const server = require("http").createServer(app);

server.listen(config.localPort);

server.on("error", function(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(config.localPort + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(config.localPort + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on("listening", function() {
  console.log("Listening on " + config.localPort);
});

console.log("Service running.");

app.set("generateJourneys", generateJourneys);

function checkAndInstallHook(project) {
  /* Look up hooks for this Journey project, and install hook if missing */
  return gitlab.private("/projects/" + project.id + "/hooks").then((hooks) => {
    for (let i = 0; i < hooks.length; i++) {
      if (hooks[i].url === config.hook) {
        return;
      }
    }

    /* No hook! Set one! */
    console.log("No hook installed for " + project.name_with_namespace + " to " +
                config.hook + ". Installing.");

    return gitlab.private("/projects/" + project.id + "/hooks", "POST", {
        url: config.hook,
        push_events: true,
        merge_requests_events: true,
        tag_push_events: true,
        enable_ssl_verification: false
    }).then(() => {
      console.log("Hook installed for " + project.name_with_namespace + ".");
    }).catch(function(error) { /* POST hook failed */
      console.warn("Error creating hook for " + project.name_with_namespace);
      console.warn("Error: " + error);
      return reject(new Error("Unable to install hook for project " + project.id));
    });
  }).catch(function(error) { /* GET hooks failed */
    let statusCode = parseInt(error);
    if (statusCode == error) {
      console.warn("Error querying hooks for " + project.name_with_namespace);
      if (statusCode > 400 && statusCode <= 500) {
        console.warn("Verify groupPrivateToken is a valid user token in node-dj.json for server: " +
                    config.gitlabUrl);
        console.warn(": **ALSO** Verify groupPrivateToken is member of the group '" + config.groupName + "' as a 'Master'");
      } else {
        console.warn(error);
      }
    }
    if (error instanceof Error) {
      return Promise.reject(error);
    }
    return Promise.reject(new Error("Unable to request hooks for project " + project.id));
  });
}

function generateJourneys() {
  /* Set the global journeyList to the new promise which will resolve to the
   * newly parsed journey information */
  config.journeyList = new Promise((resolve, reject) => {
    let journeys = [];

    /* request top level group info for the main Journey group */
    return getGroupProjects(gitlab, config).then((projects) => {
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
      /* Walk through each project listed in the Group */
      console.log("Processing " + projects.length + " projects.");

      return Promise.map(projects, (project) => {
        project.files = [];

        console.log("Processing project " + project.name + ".");

        return checkAndInstallHook(project).then(() => {
          return jp.parseJourneyProject(project);
        }).then(function() {
          journeys.push(project);
        });
      }, { concurrency: 5 });
    }).then(() => {
      console.log("Resolving generateJourneys to " + journeys.length + " journeys.");
      return resolve(journeys);
    });
  });

  return config.journeyList;
}

if (process.argv.length == 3) {
  console.log("Admin private token provided. Validating System hook.");
  gitlab.installSystemHook(process.argv[2], config.hook).catch(function(error) {
    console.log("Error while attempting to validate the system hook.");
    console.warn(error);
  });
} else {
  console.log("Admin private token not provided. Not checking system hook.");
}
