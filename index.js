#!/usr/bin/env node
'use strict';
const DockerEvents = require('docker-events');
const Dockerode = require('dockerode');
const logall = require('logr-all');
const get = require('lodash.get');

const verboseMode = process.env.VERBOSE === '1';

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
  reporters: {
    flat: {
      options: {
        theme: {
          keys: 'cyan'
        },
        tagColors,
        flatDepth: 3
      }
    },
    slack: {
      options: {
        hideTags: true,
        username: 'docker-watch',
        tagColors: {
          start: 'good',
          stop: 'danger'
        },
        iconURL: 'https://www.docker.com/sites/default/files/vertical_small.png'
      }
    }
  }
};
const log = logall(logOptions);
const docker = new Dockerode();
const emitter = new DockerEvents({ docker });
emitter.start();

const intervals = {};
emitter.on('connect', (msg, e) => {
  log(['connected'], 'connected to docker api');
});

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
const maxAge = 60000;
const intervalLength = 5000;
const handleMessage = (message) => {
  // non-verbose mode logs matching tags for 'start' and 'stop' events:
  if (!message) {
    return;
  }
  const tags = [];
  const name = get(message, 'Actor.Attributes.name', '');
  if (message.Action === 'start') {
    const container = docker.getContainer(message.id);
    intervals[name] = {
      start: new Date().getTime(),
      interval: setInterval(() => {
        container.inspect((err, data) => {
          if (err) {
            return;
          }
          const state = data.State.Status;
          const age = new Date().getTime() - intervals[name].start;
          if (['new', 'pending'].includes(state)) {
            if (age > maxAge) {
              log(['docker', 'hanged'], `container ${name} has been in state ${state} for ${age}ms`);
            }
          } else {
            clearInterval(intervals[name].interval);
            delete intervals[name];
          }
        });
      }, intervalLength)
    };
  }
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
