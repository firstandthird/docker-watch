#!/usr/bin/env node
'use strict';
const DockerEvents = require('docker-events');
const Dockerode = require('dockerode');
const Logr = require('logr');
const logrSlack = require('logr-slack');
const get = require('lodash.get');

const verboseMode = process.env.VERBOSE === '1';

const tagColors = {
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
        tagColors
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
      filter: ['notify'],
      hideTags: true,
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

if (slackNotify.length !== 0) {
  log(['docker-watch', 'initializing'], `docker-watch will match against: ${slackNotify}`);
}

const emitter = new DockerEvents({
  docker: new Dockerode()
});
emitter.start();

emitter.on('connect', () => {
  log(['connected'], 'connected to docker api');
});

const handleMessage = (message, tags) => {
  // non-verbose mode logs matching tags for 'start' and 'stop' events:
  const name = get(message, 'Actor.Attributes.name', '');
  if (name) {
    tags.unshift(name);
    for (let i = 0; i < slackNotify.length; i++) {
      const match = name.match(slackNotify[i]);
      if (match && match.length > 0) {
        tags.push('notify');
        continue;
      }
    }
  }
  log(tags, message);
};

const registerEvents = (eventList) => {
  eventList.forEach((eventName) => {
    emitter.on(eventName, (message) => {
      handleMessage(message, [eventName]);
    });
  });
};

if (verboseMode) {
  registerEvents(['start', 'stop', 'connect', 'disconnect', '_message', 'create', 'die', 'destroy']);
} else {
  registerEvents(['start', 'stop']);
}
