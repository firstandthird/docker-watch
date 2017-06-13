#!/usr/bin/env node
'use strict';
const DockerEvents = require('docker-events');
const Dockerode = require('dockerode');
const Logr = require('logr');
const logrSlack = require('logr-slack');
const logrConsole = require('logr-console-color');

const colors = {
  start: 'bgGreen',
  stop: 'bgRed'
};

const logOptions = {
  reporters: {
    consoleColor: {
      reporter: logrConsole,
      options: {
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

const emitter = new DockerEvents({
  docker: new Dockerode()
});
emitter.start();

emitter.on('connect', () => {
  log(['docker-monitor', 'connected'], 'connected to docker api');
});

emitter.on('start', (message) => {
  log(['docker-monitor', 'start'], { name: message.from, id: message.id });
});

emitter.on('stop', (message) => {
  log(['docker-monitor', 'stop'], { name: message.from, id: message.id });
});
