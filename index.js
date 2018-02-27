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
        theme: {
          keys: 'cyan'
        },
        tagColors
      }
    }
  }
};

if (process.env.SLACK_HOOK) {
  logOptions.reporters.slack = {
    reporter: logrSlack,
    options: {
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

const logEvents = {
  container: ['restart', 'start', 'stop', 'health_status', 'kill', 'die'],
  service: ['update', 'remove', 'create'],
  node: ['create', 'remove', 'update']
};

const handleMessage = (message) => {
  // non-verbose mode logs matching tags for 'start' and 'stop' events:
  if (!message) {
    return;
  }
  const tags = []
  const name = get(message, 'Actor.Attributes.name', '');
  if (name) {
    tags.push(name);
    for (let i = 0; i < slackNotify.length; i++) {
      const match = name.match(slackNotify[i]);
      if (match && match.length > 0) {
        tags.push('notify');
        continue;
      }
    }
  }
  tags.push(message.Type);
  tags.push(message.Action);

  if (verboseMode || (logEvents[message.Type] && logEvents[message.Type].indexOf(message.Action) !== -1)) {
    log(tags, message);
  }
};

emitter.on('_message', handleMessage);
