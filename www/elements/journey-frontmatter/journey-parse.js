/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";
(function() {
var global = this, yaml = null;

/*
front matter format:

---
key0: key0-value0
key0: key0-value1[,key0-valueN]
key1: key1-value0
---

key is [:alpha:][:alpha::digit:]*
value is a CSV. if a comma needs to be in a string,
it must be quoted. quotes cannot be in the value.

*/

function findYaml(lines) {
  var start = -1, end = -1, tripleDash = /^\s*---\s*$/,
    endoffile = false;

  for (var i = 0; i < lines.length; i++) {
    if (tripleDash.exec(lines[i])) {
      if (start == -1) {
        start = i + 1;
        continue;
      }
      end = i;
      break;
    } else if (start == -1) {
      /* Not a --- line and start isn't set... no front-matter yaml */
      return null;
    }
  }

  /* Yaml block not found, or it started at the end of the file */
  if (start == -1 || start == lines.length) {
    return null;
  }

  /* Empty yaml block */
  if (end == -1 || start == end) {
    return null;
  }

  /* If no end, return to the end of the file */
  if (end == -1) {
    endoffile = true;
    end = lines.length;
  }

  /* A yaml fence was matched, so discard the start fence */
  lines.shift();

  var yaml = lines.splice(0, end);
  /* If the end wasn't the end of the file, then remove the last
   * line from the yaml (it's the --- closing fence) */
  if (!endoffile) {
    yaml.pop();
  }
  return yaml;
}

function parseFrontMatter(content) {
  try {
    var lines = content.split("\n"),
      doc = findYaml(lines);

    if (!doc) {
      return null;
    }

    doc = yaml.safeLoad(doc.join("\n"));

    /* If yaml was found, lines was modified to remove the yaml */
    doc.content = lines.join("\n");

    return doc;
  } catch (error) {
    console.warn(error);
    /* If there was an error parsing the yaml, return the original document */
    return null;
  }
}

/* Are we in Node.js? https://nodejs.org/api/modules.html#modules_exports_shortcut */
if (typeof exports !== "undefined") { /* Node.js short-cut to module.exports */
  /* Does the module subsystem exist? If not, this isn't actually Node.js */
  if (typeof module !== "undefined" && module.exports) {
    this.jsyaml = require("js-yaml");
    exports = module.exports = parseFrontMatter;
  } else {
    exports.parseFrontMatter = parseFrontMatter;
  }
} else {
  this.parseFrontMatter = parseFrontMatter;
}

if (!yaml) {
  if (!this.jsyaml) {
    throw "js-yaml.min.js needs to be loaded prior to this script";
  }
  yaml = this.jsyaml;
}

}).call(this);
