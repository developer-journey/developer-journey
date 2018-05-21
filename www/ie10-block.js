/*
 * Copyright (C) 2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */

(function() {
  "use strict";

  var msg = "The Developer Journey CMS requires Chrome, " +
    "Firefox, or Internet Explorer 11/Edge. Older browsers do not " +
    "implement the required web standards.";

  function getIEVersion() {
    var agent = navigator.userAgent.toLowerCase(),
      tokenIndex = agent.indexOf('msie');
    return (tokenIndex != -1) ? parseInt(agent.substring(tokenIndex)) : false;
  }

  /* If the User Agent is IE9 or older, block loading in the browser */
  if (getIEVersion() && getIEVersion() <= 10) {
    console.log("IE10 or older detected.")

    /* Start a recurring timeout that keeps checking for document.body and
     * once found, set the body to a "Browser not supported..." message */
    function blockLoading() {
      if (!document.body) {
        setTimeout(blockLoading, 10);
        return;
      }

      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }

      /* Try and stop loading of any objects by replacing the DOM immediately */
      document.body.innerHTML = msg;

      /* Polymer and other agents may still be running and DOM stamping, so
       * wait for DOMContentLoaded to complete, then re-blank the DOM */
      document.addEventListener('DOMContentLoaded', function() {
        document.body.innerHTML = "<div style='margin:5em;text-align:center;font-size:30pt;'>" + msg + "</div>";
      });
    }

    blockLoading();
  }
})();
