/*
 * Copyright (C) 2017-2018 Intel Corporation
 * SPDX-License-Identifier: Apache-2.0
 */
"use strict";

const express = require('express'),
	fs = require('fs'),
	url = require('url');

const router = express.Router();

/* List of filename extensions we know are "potential" file extensions for
 * assets we don't want to return "index.html" for */
const extensions = [
	"html", "js", "css", "eot", "gif", "ico", "jpeg", "jpg", "mp4",
	"md", "ttf", "txt", "woff", "woff2", "yml", "svg"
];

/* Build the extension match RegExp from the list of extensions */
const extensionMatch = new RegExp("^.*?(" + extensions.join('|') + ")$", "i");

/* To handle dynamic routes, we return index.html to every request that
 * gets this far -- so this needs to be the last route.
 *
 * However, that introduces site development problems when assets are
 * referenced which don't yet exist (due to bugs, or sequence of adds) --
 * the server would return HTML content instead of the 404.
 *
 * So, check to see if the requested path is for an asset with a recognized
 * file extension.
 *
 * If so, 404 because the asset isn't there. otherwise assume it is a
 * dynamic client side route and *then* return index.html.
 */
router.get("/*", function (req, res /*, next*/ ) {
	const parts = url.parse(req.url);
	const index = fs.readFileSync(req.config.docRoot + 'index.html', 'utf8').replace(
		/<script>'<base href="BASEPATH">';<\/script>/,
		"<base href='" + req.config.basePath + "'>");
	res.send(index);
	return;
	if (req.url == '/' || !extensionMatch.exec(parts.pathname)) {
		/* Replace <script>'<base href="/travel/">';</script> in index.html with the basePath
		 * We don't really use handlebars, but the syntax is nice for this specific
		 * usage */
		// const index = fs.readFileSync(req.config.docRoot + 'index.html', 'utf8').replace(
		//   /<script>'<base href="BASEPATH">';<\/script>/,
		//   "<base href='" + req.config.basePath + "'>");
		// res.send(index);
		// return;
	}

	// console.log("Page not found: " + req.url);
	// return res.status(404).json({
	//   message: "Page not found",
	//   status: 404
	// });
});

let config, gitlab;
module.exports = function (_config, _gitlab) {
	config = _config;
	gitlab = _gitlab;
	return router;
};
