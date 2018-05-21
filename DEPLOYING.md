# Developer Journey: DEPLOYING

Copyright (C) 2015-2018 Intel Corporation
SPDX-License-Identifier: Apache-2.0

# Overview
Deploying the Developer Journey infrastructure relies on three components:

1. A GitLab instance
2. The Developer Journey backend
3. nginx to act as a proxy server to #2

1 and 2 can be installed on their own server or run from the same server.
This document will install GitLab and the Developer Journey on the same
server. The Developer Journey will be available from the server's 
root /, and GitLab will be available from /gitlab.

# Installation

## GitLab

An easy way to install GitLab is to use the official docker images for the
Community Edition (CE):

  https://docs.gitlab.com/omnibus/docker/README.html

Because we want to host GitLab off of the root, behind an nginx proxy,
GitLab we need to configured GitLab listen to different local ports. To 
simplify upgrades, using docker-compose is recommended.

GitLab will be configured to listen on ports 10443 for inbound HTTPS requests.

Below are the steps to install GitLab:

(you can copy and paste these directly into a terminal)

```bash
export GITLAB_HOST=$(hostname)
sudo apt-get update
sudo apt install -y docker docker-compose
sudo service docker start
mkdir ~/gitlab
cd ~/gitlab
cat << EOF > docker-compose.yml
web:
  container_name: 'gitlab'
  image: 'gitlab/gitlab-ce:latest'
  restart: always
  hostname: '${GITLAB_HOST}'
  environment:
    GITLAB_RELATIVE_URL_ROOT: '/gitlab'
    GITLAB_OMNIBUS_CONFIG: external_url 'https://${GITLAB_HOST}/gitlab'
  ports:
    - '10080:80'
    - '10443:443'
    - '10022:22'
  volumes:
    - '/srv/gitlab/config:/etc/gitlab'
    - '/srv/gitlab/logs:/var/log/gitlab'
    - '/srv/gitlab/data:/var/opt/gitlab'
EOF
```

## Install certificates for GitLab and NGINX

Because we are hosting ${GITLAB_HOST} via HTTPS, GitLab will require that
certificates be installed.

You can generate them using `letsencrypt` or create self-signed 
certificates. Install them into:

    /srv/gitlab/config/ssl/${GITLAB_HOST}.key   <= Private key
    /srv/gitlab/config/ssl/${GITLAB_HOST}.crt   <= Certificate file

To create a self-signed certificate, you can run the following snippet
to create the certificate and move them into the paths the Docker
image will use:

```bash
cat << EOF | openssl req -newkey rsa:2048 -nodes -keyout ${GITLAB_HOST}.key -x509 -days 365 -out ${GITLAB_HOST}.crt
US
Oregon
Portland
DJ

$(hostname)

EOF
sudo mkdir -p /srv/gitlab/config/ssl
sudo mv ${GITLAB_HOST}.{key,crt} /srv/gitlab/config/ssl/
```

## Start the GitLab docker image

Next we will create the Docker image using docker-compose:

```bash
cd ~/gitlab
sudo docker-compose up -d
```

Once the above completes, test that you can access the Docker instance:
```bash
cd ~/gitlab
sudo docker exec -it gitlab gitlab-ctl status
```

You can connect to the GitLab instance running in the container:
```bash
xdg-open https://${GITLAB_HOST}:10443/gitlab
```

The first time you visit your GitLab instance (via the above webpage), 
you will be asked to set the admin password. Once you have changed it, 
you can login with the username **root** and the password you set.


### Create Journey project and account tokens

For the Developer Journey backend to work, it needs to be able to connect
to the GitLab instance in order to cache journeys, parse meta data,
and to allow users to edit journey content.

For this to work, you need to create the following in GitLab:

#### A group called "journeys"

If you change the name, change the "groupName" value in node-dj.json

You create a new group at:

  https://[[gitlabHost]][[gitlabPath]]/groups/new

#### A user with Master access to the above group

Create a new user at:

  https://[[gitlabHost]][[gitlabPath]]/admin/users/new

We use the name "ma-journeys-master" for "Machine Account Journeys Master".

Once the user is created, add it as a Master member to the "journeys" group via:

  https://[[gitlabHost]][[gitlabPath]]/groups/journeys/group_members

#### A personal access token for the above user

Impersonate or login as the above user:

  https://[[gitlabHost]][[gitlabPath]]/admin/users/ma-journeys-master

and click "Impersonate"

Then go to the personal_access_tokens page and create a new token:

  https://[[gitlabHost]][[gitlabPath]]/profile/personal_access_tokens

Set the name to "Developer Journeys Token", no expiration date, and select
"api Access your API"

Once the token is created, put it in the value for "groupPrivateToken" in
node-dj.json.

Click "Stop impersonation"

#### An anonymous user with no limited access

This is used for read-only access to the GitLab APIs (only authenticated user
accounts can use the APIs). This username goes in "anonymousUser".

Create the user via this page:

  https://[[gitlabHost]][[gitlabPath]]/admin/users/new

We use the name "ma-journeys-anon" for "Machine Account Journeys Anonymous".

Make sure to set the access to "Regular" and clear "Can create group".

#### A personal access token for the anonymous user

Impersonate or login as the above user:

  https://[[gitlabHost]][[gitlabPath]]/admin/users/ma-journeys-anon

and click "Impersonate"

Then go to the personal_access_tokens page and create a new token:

  https://[[gitlabHost]][[gitlabPath]]/profile/personal_access_tokens

Set the name to "Developer Journeys Token", no expiration date, and select
"api Access your API"

Once the token is created, put it in the value for "anonymousPrivateToken"
in node-dj.json.

Click "Stop impersonation"

#### OAUTH2 application id and secret key

In order for the Developer Journey application to authenticate with GitLab,
OAUTH needs to be configured, which requires an application id and secret
be generated by GitLab.

Adding the application is done here:

  https://[[gitlabHost]][[gitlabPath]]/admin/applications/new

Set the Name to "Developer Journey"

Set the Redirect URI to [[hostUrl]]/[[basePath]]/authenticate, for example:

  https://example.com/developerjourney/authenticate

The Redirect URL must be accessible from web clients that will be accessing
the Developer Journey, so "localhost" is likely not what you want.

Set the Scopes to "api Access your API".

Once you click Submit, GitLab will provide the application id and secret. Put
those values in "applicationId" and "secret" in node-dj.json.

**NOTE**: Make sure that the node-dj.json is set to mode rw-------- (0600) and
that the user account used to launch the Developer Journey is the owner of the
file.

### Upgrading GitLab

For information on upgrading your GitLab container, and other details, see
the upstream [GitLab documentation](https://docs.gitlab.com/omnibus/docker/README.html).

The short overview, if you used docker-compose, is to run the following:

```bash
cd ~/gitlab
sudo docker-compose pull
sudo docker-compose up -d
```

Need to troubleshoot? You can check the GitLab docker logs:
```bash
sudo docker logs -f gitlab &
```

## Developer Journey

Installing the Developer Journey requires you to clone the repository,
install dependencies, and edit the node-dj.json file for your
configuration.

### Prerequisites

The Developer Journey front-end uses Polymer and Bower. Polymer
requires NodeJS > 6.x. To install NodeJS on Ubuntu you can run the
following:

```bash
wget -qO- https://deb.nodesource.com/setup_6.x | sudo bash -
sudo apt-get install --yes nodejs
```

You can then install the latest npm, polymer-cli, and bower:
```bash
sudo npm install --global npm@latest
sudo npm install --global polymer-cli
sudo npm install --global bower
```


### Installing Developer Journey project

Some of the components for the DJ front-end are developed as stand-alone
bower modules. They are expected to be loaded out of a local `gitlab`
system resource.

To use, configure your local `~/.ssh/config` to contain the following:

```text
Host gitlab
  Hostname ${GITLAB_HOST}
  Port 10443
  User git
  IdentitiesOnly yes
```

You will then need to configure your .ssh keys in your local GitLab 
instance, and publish the journey-* modules into your local GitLab so 
they can be cloned.

Once the above is done, you can install the Developer Journey system:

```bash
cd ~/developerjourney
npm install
cd www
bower install
cd ..
```

Prior to starting the server, you can configure an ADMIN token and provide
that to a single instance run of the Developer Journey application. It will
use that token to create a system hook to connect back to the Developer
Journey when new projects and groups are created under the "groupName" group.

To create an admin token, as an admin user go to:

  https://[[gitlabHost]][[gitlabPath]]/profile/personal_access_tokens

Use the name "Developer Journeys Admin" (or similar) and copy the access token. Then launch the NodeJS service using that token:

```bash
npm start ${ACCESS_TOKEN}
```

After installing the system hook, the application will exit. You can now
revoke the "Developer Journeys Admin" access token:

  https://[[gitlabHost]][[gitlabPath]]/profile/personal_access_tokens

You can then start the server:

```bash
npm start
```


At this point, the developerjourney server will connect to GitLab to query
for any journeys.

## NGINX

nginx will be used to accept http and https connections to the Developer
Journey backend application written in NodeJS.

### Install nginx package

```bash
sudo apt install nginx
```

### Configure SSL keys for nginx

Copy the keys used with GitLab into your nginx installation:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp /srv/gitlab/config/ssl/${GITLAB_HOST}.* /etc/nginx/ssl/
```

### Configure nginx to serve the Developer Journey

Then edit `/etc/ngins/sites-enabled/default` to contain the following,
changing GITLAB_HOST in the ssl_certificate* lines with the your computer's
hostname:

```text
# Declare an upstream proxy named 'dj' which connects to
# our Node.js server
upstream dj {
        server 127.0.0.1:8911;
}

# Optional: Set a proxy named 'gitlab' to direct to our
# docker container.
upstream gitlab {
        server 127.0.0.1:10080;
}

# Redirect insecure HTTP to HTTPS
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  return 301 https://$host$request_uri;
}

server {
  # SSL configuration
  #
  ssl on;
  listen 443 ssl;
  ssl_certificate /etc/nginx/ssl/${GITLAB_HOST}.crt;
  ssl_certificate_key /etc/nginx/ssl/${GITLAB_HOST}.key;
  # This section declares the location 'developerjourney'
  # which declares that any request matching this location
  # is passed to the upstream proxy named 'dj'
  location /developerjourney {
    proxy_pass http://dj;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $http_host;
    proxy_set_header X-NginX-Proxy true;
    proxy_pass_header Set-Cookie;
    proxy_pass_header P3P;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # Optional: Set /gitlab to redirect to the GitLab docker container
  location /gitlab {
    proxy_pass http://gitlab;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $http_host;
    proxy_set_header X-NginX-Proxy true;
    proxy_pass_header Set-Cookie;
    proxy_pass_header P3P;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

### Test nginx + Developer Journey

You can then restart nginx and test it:

```bash
sudo service nginx restart
xdg-open https://${GITLAB_HOST}/gitlab
```
