/*
Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0
*/
"use strict";
const fs = require('fs'),
  removeComments = require('./remove-comments');

function validate_config(filename, requiredFields) {
  var config, contents;

  try {
    contents = fs.readFileSync(filename, { encoding: 'utf8' });
  } catch (error) {
    console.log('Unable to read ' + filename + ': ' + error.message);
    process.exit(-1);
  }

  contents = removeComments(contents);

  try {
    config = JSON.parse(contents);
  } catch (error) {
    console.log('Unable to parse ' + filename + ':' + error.message);
    process.exit(-1);
  }

  requiredFields.forEach(function(field) {
    if (!(field in config)) {
      console.error(filename + ' configuration file incomplete: Missing "' + field + '"');
      console.error("Terminating process.");
      process.exit(-1);
    }
  });

  return config;
}

module.exports = validate_config;
