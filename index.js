#!/usr/bin/env node
'use strict';
const DockerEvents = require('docker-events');
const Dockerode = require('dockerode');
const Logr = require('logr');
const logrSlack = require('logr-slack');
const get = require('lodash.get');
const logrSentry = require('logr-sentry');

const verboseMode = process.env.VERBOSE === '1';

const alertTags = process.env.ALERT_TAGS ? process.env.ALERT_TAGS.split(',') : [];
const filterTags = ['error', 'notify'].concat(alertTags);
const tagColors = {
  //  green tags:
  start: 'bgGreen',
  create: 'bgGreen',
  // red tags:
  stop: 'bgRed',
  die: 'bgRed',
  // yellow tags:
  kill: 'bgYellow',
  remove: 'bgYellow',
  // message-emitters:
  container: 'blue',
  image: 'magenta',
  service: 'cyan',
  node: 'green',
};

const logOptions = {
  includeDetails: process.env.INCLUDE_DETAILS === '1',
  reporters: {}
};

if (process.env.LOG_TYPE === 'logfmt') {
  logOptions.reporters.logfmt = {
    reporter: require('logr-logfmt'),
    options: {
      color: true,
      appColor: true
    }
  };
} else {
  logOptions.reporters.flat = {
    reporter: require('logr-flat'),
    options: {
      timestamp: false,
      appColor: true,
      theme: {
        keys: 'cyan'
      },
      tagColors,
      flatDepth: 3
    }
  };
}

if (process.env.SENTRY_DSN) {
  logOptions.reporters.sentry = {
    reporter: logrSentry,
    options: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENV,
      logger: 'docker-watch',
      filter: filterTags
    }
  };
}
if (process.env.SLACK_HOOK) {
  logOptions.reporters.slack = {
    reporter: logrSlack,
    options: {
      username: 'docker-watch',
      slackHook: process.env.SLACK_HOOK,
      filter: filterTags,
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
const emitter = new DockerEvents({
  docker: new Dockerode()
});
emitter.start();

emitter.on('connect', () => {
  log(['connected'], 'connected to docker api');
});
if (process.env.SLACK_HOOK) {
  log(`Slack reporter is watching tags: ${filterTags}`);
}
if (process.env.SENTRY_DSN) {
  log(`Sentry is watching tags: ${filterTags}`);
}

const logEvents = {
  container: ['restart', 'start', 'stop', 'health_status', 'health_status: healthy', 'health_status: unhealthy', 'kill', 'die'],
  service: ['update', 'remove', 'create'],
  image: ['pull', 'delete'],
  node: ['create', 'remove', 'update']
};

const cleanLogs = (message) => {
  delete message.time;
  delete message.timeNano;
  delete message.scope;
  // delete all 'Actor' properties:
  if (!logOptions.includeDetails) {
    delete message.Actor;
  }
};

const handleMessage = (message) => {
  // non-verbose mode logs matching tags for 'start' and 'stop' events:
  if (!message) {
    return;
  }
  const tags = [];
  const name = get(message, 'Actor.Attributes.name', '');
  if (name) {
    tags.push(name);
  }
  tags.push(message.Type);
  tags.push(message.Action);
  // if exit with error add an error tag:
  if (message.Action === 'die' && message.Actor.Attributes.exitCode === '1') {
    tags.push('error');
  }

  if (tags.includes('health_status: unhealthy')) {
    tags.push('error');
  }
  if (message.Actor.Attributes) {
    if (message.Type === 'service' && message.Action === 'update' && message.Actor.Attributes['updatestate.new']) {
      tags.push(message.Actor.Attributes['updatestate.new']);
    }
    if (message.Actor.Attributes['updatestate.new'] === 'rollback_started') {
      tags.push('error');
      tags.push('rollback');
    }
  }
  cleanLogs(message);
  if (verboseMode || (logEvents[message.Type] && logEvents[message.Type].indexOf(message.Action) !== -1)) {
    message.message = `${name} ${message.Type} ${message.Action}`;
    log(tags, message);
  }
};

emitter.on('_message', handleMessage);
