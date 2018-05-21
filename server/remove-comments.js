/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 *
 * This method will only strip comments from otherwise legal JSON
 * content; it is not a general purpose comment stripper as it does
 * not check against certain patterns which can exist in normal code **and**
 * contain the "comment begin" pattern.
 *
 * https://www.json.org/
 *
 * JSON consists of either an object containing name:value pairs or an array
 * of values.
 *
 * JSON name is a string.
 *
 * JSON values can be:
 * + a string
 * + a number
 * + an object (JSON object)
 * + an array
 * + a boolean
 * + null
 *
 * String values must be written with double quotes.
 *
 * Given the above syntax, the only time a comment begining should not be
 * stripped is if it is in a string.
 *
 * The parser task is then to correctly watch for string begins, and then
 * scan forward to the end-of-string. If not in a string, then scan for
 * comment-begins and then to comment-end, regardless of any other characters
 */
module.exports = function(str) {
  let s = 0, d = 0,
    inString = false,
    inSingleLine = false,
    inMultiLine = false;

  /* Convert the string to an array we can modify it in-place */
  str = str.split("");

  while (s < str.length) {
    let c = str[s++];

    /* Consume single-line comment */
    if (inSingleLine) {
      if (c == "\n") {
        str[d++] = c;
        inSingleLine = false;
        continue;
      }
      /* Empty consume */
      continue;
    }

    /* Consume multi-line comment */
    if (inMultiLine) {
      if (c == "*") {
        if (s == str.length) {
          /* Buffer ended while in a comment... */
          break;
        }
        c = str[s++];
        if (c == "/") {
          inMultiLine = false;
          continue;
        }
      }

      /* Empty consume */
      continue;
    }

    /* If in string, look for end of string */
    if (inString) {
      if (c == "\\") {
        /* Escape character in string; consume two characters */
        /* Copy consume */
        str[d++] = c;
        if (s == str.length) {
          /* Buffer ended while in a string */
          break;
        }
        /* Copy consume */
        str[d++] = str[s++];
        continue;
      }

      if (c == "\"") {
        inString = false;
      }

      /* Copy consume */
      str[d++] = c;
      continue;
    }

    /* Not in a string, so look for start of string */
    if (c == "\"") {
      inString = true;
      /* Copy consume */
      str[d++] = c;
      continue;
    }

    /* Not in a comment, or in a string, so look for start of a comment */
    if (c == "/") {
      if (s == str.length) {
        /* Buffer end while potential start of comment */
        str[d++] = c;
        break;
      }

      c = str[s++];

      if (c == "/") {
        inSingleLine = true;
        continue;
      }

      if (c == "*") {
        inMultiLine = true;
        continue;
      }

      /* Consome both characters */
      str[d++] = "/";
      str[d++] = c;
      continue;
    } else if (c == "#") {
      inSingleLine = true;
      continue;
    }

    str[d++] = c;
  }

  /* Return only the first d characters of the string. */
  return str.slice(0, d).join("");
};
