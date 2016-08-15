'use strict';
const Docker = require('dockerode');
const fs = require('fs');
const MemoryStream = require('memorystream');

const listActiveContainers = (docker, callback) => {
  docker.listContainers({ all: true }, callback);
};

// we stream the resource usage with 'stats'
// this returns a copy of that stream
const getResourceStream = (docker, containerId, callback) => {
  const container = docker.getContainer(containerId);
  container.stats({}, (err, stats) => {
    if (err) {
      throw err;
    }
    const memStream = new MemoryStream();
    stats.pipe(memStream);
    return callback(null, memStream);
  });
};

const getDocker = () => {
  const socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  const stats = fs.statSync(socket);
  if (!stats.isSocket()) {
    throw new Error('Are you sure the docker is running?');
  }
  return new Docker({ socketPath: socket });
};

module.exports.getResourceStream = (containerId, callback) => {
  getResourceStream(getDocker(), containerId, callback);
};

module.exports.listActiveContainers = (callback) => {
  listActiveContainers(getDocker(), callback);
};

const launchTestContainer = (callback) => {
  let testContainer = false;
  module.exports.listActiveContainers((err, containers) => {
    if (err) {
      throw err;
    }
    for (let i = 0; i < containers.length; i++) {
      if (containers[i].Status.indexOf('Up') > -1) {
        testContainer = containers[i];
        break;
      }
    }
    if (testContainer) {
      return callback();
    }
    console.log('ERROR: Could not find a running docker container.  Make sure you have one running before launching tests');
    process.exit(1);
  });
};
module.exports.launchTestContainer = launchTestContainer;
