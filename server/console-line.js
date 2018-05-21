/*
Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0
*/
/* monkey-patch console.log to prefix with file/line-number */
if (process.env.LOG_LINE) {
  let cwd = process.cwd(),
    cwdRe = new RegExp("^[^/]*" + cwd.replace("/", "\\/") + "\/([^:]*:[0-9]*).*$");
  [ "log", "warn", "error" ].forEach(function(method) {
    console[method] = (function () {
      let orig = console[method];
      return function () {
        function getErrorObject() {
          try {
            throw Error('');
          } catch (err) {
            return err;
          }
        }

        let err = getErrorObject(),
          caller_line = err.stack.split("\n")[4],
          args = [caller_line.replace(cwdRe, "$1 -")];

        /* arguments.unshift() doesn't exist... */
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }

        orig.apply(this, args);
      };
    })();
  });
}
