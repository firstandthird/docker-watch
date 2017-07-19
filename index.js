#!/usr/bin/env node
'use strict';
const DockerEvents = require('docker-events');
const Dockerode = require('dockerode');
const Logr = require('logr');
const logrSlack = require('logr-slack');

const colors = {
  start: 'bgGreen',
  stop: 'bgRed'
};

const logOptions = {
  reporters: {
    flat: {
      reporter: require('logr-flat'),
      options: {
        timestamp: false,
        appColor: true,
        colors
      }
    }
  }
};

if (process.env.SLACK_HOOK) {
  logOptions.reporters.slack = {
    reporter: logrSlack,
    options: {
      timestamp: false,
      username: 'docker-watch',
      slackHook: process.env.SLACK_HOOK,
      tagColors: {
        start: 'good',
        stop: 'danger'
      },
      iconURL: 'https://www.docker.com/sites/default/files/vertical_small.png'
    }
  };
}
const log = Logr.createLogger(logOptions);

const slackNotify = process.env.SLACK_NOTIFY ? process.env.SLACK_NOTIFY.split(',') : [];

log(['docker-watch', 'initializing'], `docker-watch will match against: ${slackNotify}`);

const emitter = new DockerEvents({
  docker: new Dockerode()
});
emitter.start();

emitter.on('connect', () => {
  log(['docker-watch', 'connected'], 'connected to docker api');
});

emitter.on('start', (message) => {
  const tags = ['docker-watch', 'start'];
  for (let i = 0; i < slackNotify.length; i++) {
    const match = message.from.match(slackNotify[i]);
    if (match && match.length > 0) {
      tags.push('notify');
      continue;
    }
  }
  log(tags, { name: message.from, id: message.id });
});

emitter.on('stop', (message) => {
  const tags = ['docker-watch', 'stop'];
  for (let i = 0; i < slackNotify.length; i++) {
    const match = message.from.match(slackNotify[i]);
    if (match && match.length > 0) {
      tags.push('notify');
      continue;
    }
  }
  log(tags, { name: message.from, id: message.id });
});
