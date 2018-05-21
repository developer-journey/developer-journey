# Developer Journey

Copyright (C) 2015-2018 Intel Corporation

SPDX-License-Identifier: Apache-2.0

---

Developer Journey content consists of an optional frontmatter block, 
followed by markdown. The markdown follows the CommonMark specification, 
with additional formatting and context extracted from the content based 
on content structure patterns. For example, if a title is not provided
in the frontmatter, the first heading defined in the markdown will
be used as the document title. Naming headings a specific way results
in those blocks being visualized in different ways.

Context is defined by matching against headers used in the content. 

If a header matches a pattern, it starts a context block which will 
continue until another header of the same level is used in the content.

One example of this header type is the `Step`.

Written as a regular expression, a step is identified as:

    ^#+\s*(step|next(\s+step))\s*([0-9.]+)?:\s*(.+)$

Here is what the above regular expression does:

1. `^#+` Starts with one or more hash symbols
2. `\s*` Optional whitespace
3. `(step|next(\s+step)` The words "step" or "next" or "next step"
4. `\s*` Optional whitespace
5. `([0-9.]+)?` Optional step number
    Notice that pseudo-decimals are allowed in the step number.
6. `:` A colon
7. `\s*` Optional whitespace
8. `(.+)$` One or more characters to the end of the line

If line #5 is not provided, the step number is automatically generated 
based on the last step number. For example if the previous number was 
1.1, the next step will be 1.2. The level of hashes in #1 do not change 
the step number. If the previous number was 6, the auto-generated number 
will be 7.

Line #8 is used as the name of the step in the step index as well as 
when decorating the content block containing the step.


# Overview

The Developer Journey project provides a backend service layer between
the frontend web application and GitLab.

The backend service layer is located in the `server` directory. The frontnd
can be found in the `www` directory.

If you are looking to deploy a local instance of the Developer Journey
infrastructure, see DEPLOYING.md, which walks you through configuring
GitLab as well as configuring the backend.

To debug the backend, you can use the debug script:

```bash
npm run debug
```

The above will launch the node-inspector, connected to a new instance
of the server.


# Content structure

Developer Journeys are collections of related content, revisioned and
managed using git for version control and work-flow management.

The backend provides APIs for communicating with GitLab to manage that 
content.

GitLab
---
```text
.
├── developerjourney        (project)
│   ├── journey-frontmatter (JS script which will parse frontmatter)
│   ├── journey-image       (Polymer element supporting DJFM syntax for image styles)
│   │   └── ...
│   └── developerjourney    (NodeJS backend and web application)
│       ├── www             (web application)
│       ├── server          (GitLab service layer)
│       └── ...
│
├── journeys
│   ├── journey1         (project)
│   │   ├── entry1       (djfm)
│   │   ├── ...
│   │   ├── entryN       (djfm)
│   │   └── assets/
│   │       ├── resource1.jpg
│   │       ├── ...
│   │       └── resourceN.jpg
│   ├── ...
│   └── journeyN         (project)
│       └── ...
│
├── user1
│   ├── fork-of-journey1 (project)
│   │   └── (local edits of journey1)
│   └── blog             (project)
│       ├── info.json
│       ├── entry1       (djfm)
│       ├── ...
│       ├── entryN       (djfm)
│       └── assets/
│           ├── resource1.jpg
│           ├── ...
│           └── resourceN.jpg
│
.
```

# Installation

See DEPLOYING.md for information on installing the Developer Journey
and GitLab infrastructure.
