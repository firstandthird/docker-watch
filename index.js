#!/usr/bin/env node
'use strict';
const Watcher = require('./lib/DockerWatcher.js');
const yargs = require('yargs');
const os = require('os');
const Logr = require('logr');
const argv = yargs
.option('cpu_threshold', {
  describe: 'threshold above which CPU is considered in elevated state',
  default: 50,
  type: 'number'
})
.option('cpu_duration', {
  describe: 'duration in milliseconds that CPU can be in elevated state before triggering a warning',
  default: 50,
  type: 'number'
})
.option('machine', {
  describe: 'an identifier this machine can use when warning of elevated state',
  default: os.hostname,
  type: 'string'
})
.help('h')
.alias('h', 'help')
.env(true)
.argv;

const log = new Logr({
  defaultTags: [argv.machine]
});
const options = {
  cpu: {
    threshold: argv.cpu_threshold,
    duration: argv.cpu_duration
  }
};
if (!argv.h && !argv.help) {
  const watcher = new Watcher(argv.machine, options, log);
  watcher.startAll();
  const runForever = () => {
    setTimeout(runForever, 10000);
  };
  runForever();
}
