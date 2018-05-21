/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

/* Polyfill `map` similar to the functionality of bluebird's map, only
 * not as fancy (for example no concurrency limit)... */
if (!Promise.map) {
  Promise.map = function(iterable, mapper/*, options*/) {
    iterable = Array.isArray(iterable) ? iterable : [ iterable ];
    return Promise.all(iterable.map(mapper));
  };
}

/* Polyfill 'mapSeries' similar to the functionality of builebird's mapSeries,
 * only not as fancy... */
if (!Promise.mapSeries) {
  Promise.mapSeries = function(iterable, mapper) {
    /* Pull off the iterables one at a time, resolve them, then move
     * to the next one */
    iterable = Array.isArray(iterable) ? iterable : [ iterable ];
    let length = iterable.length,
      results = [],
      waitForLast = Promise.resolve();

    function mapItem(index) {
      return mapper(iterable[index], index, iterable);
    }

    for (let i = 0; i < length; i++) {
      /* Capture the results (promise or otherwise) */
      results.push(waitForLast.then(mapItem));

      /* The last one to wait for is the next one to wait for... */
      waitForLast = results[results.length - 1];
    }

    return Promise.all(results);
  };
}

module.exports = Promise;
