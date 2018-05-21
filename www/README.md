# Application routes and handling

Copyright (C) 2017-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0


## Front end routes

The following routes are all processed by the front-end as a single page
application.

If the routes do not match the specification below, the back-end will return
a 400.

| route                                   | description                      |
|:----------------------------------------|:---------------------------------|
| [/users/:user]?/                        | List all journeys                |
| [/users/:user]?/:journey                | List all entries in a journey    |
| [/users/:user]?/:journey/:entry?/new    | (C) counterpart to HTTP CREATE   |
| [/users/:user]?/:journey/:entry?        | (R) counterpart to HTTP GET      |
| [/users/:user]?/:journey/:entry?/edit   | (U) counterpart to HTTP PUT      |
| [/users/:user]?/:journey/:entry?/delete | (D) counterpart to HTTP DELETE   |
| /users                                  | List all registered users        |

If provided, a 'user' must match a valid user registered with the Developer
Journey project, not just a user of the GitLab instance.

**journey** can be anything *except*: content

## content

Reserved for alias to /api/v1/content/. For example the following to URLs return
identical results:

* /api/v1/content/journey/assets/logo.png
* /content/journey/assets/logo.png

**entry** can be anything *except*:

### new, edit, delete

Reserved as operation commands.

## Back end routes

| route                                   | description                      |
|:----------------------------------------|:---------------------------------|
| /content/*                              | (R) Alias to /api/v1/content/*   |
| /api/v1/content                         | (CRUD) interface to GitLab       |
| /api/v1/authenticate                    | OAuth interfaces                 |


## Division of processing between front and back ends

For anything that matches a valid URL as defined above, the back-end will
return `www/index.html`.

For invalid paths, a status code of `400` will be returned.

For all other patterns, the back-end will:

1. Check if the requested URI exists on disk, and return it if so.
2. Check if the URI is restricted, and block if so.

If **entry** is not provided, it defaults to the top level entry: `recipe`.

Regardless of **mode**, if **journey** is not provided, redirect to `/`.


## Structure of the front end

The site is a single page application built using Polymer. The main page
handles the content dynamically based on the URL provided in the route. It
uses `app-route` to accomplish this, loading the appropriate page into an
`iron-pages` element contained in the main content area of the site.
