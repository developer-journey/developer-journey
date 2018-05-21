/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
var fs = require('fs');
if (process.argv.length < 3) {
  console.log('Usage: show FILE0..FILEn');
  process.exit(-1);
}

process.argv.shift();
process.argv.shift();

function stripComments(data) {
  /* Trim any # comments from the file */
  var lines = data.split("\n");
  data = "";
  lines.forEach(function (line) {
    var re = /(?:"(?:[^"\\]|\\.)*"|[^"#])*(#|$)/g,
      match = re.exec(line);
    if (match[1] == '#') {
      data += line.substring(0, re.lastIndex - 1);
    } else {
      data += line;
    }
  });

  return data;
}

process.argv.forEach(function (file) {
  var data;

  try {
    data = fs.readFileSync(file, "utf8");
  } catch (___) {
    console.log('Unable to read: ' + file);
    return;
  }

  try {
    data = JSON.parse(data);
  } catch (___) {
    try {
      data = JSON.parse(stripComments(data));
    } catch (___) {
      console.log('Unable to parse: ' + file);
      return;
    }
  }

  console.log(JSON.stringify(data, null, '  '));
});
