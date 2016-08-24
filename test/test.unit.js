'use strict';
const expect = require('chai').expect;
const it = require('mocha').it;
const before = require('mocha').before;
const describe = require('mocha').describe;
const beforeEach = require('mocha').beforeEach;
const ContainerWatcher = require('../lib/ContainerWatcher.js');
const CPUHistory = require('../lib/CPUHistory.js');
const DockerWatcher = require('../lib/DockerWatcher.js');
const dockerInterface = require('../lib/dockerInterface');

describe('dockerInterface', function() {
  this.timeout(25000);
  before((done) => {
    dockerInterface.launchTestContainer(done);
  });
  // todo: launch some test docker instance
  it('can list running docker containers', (done) => {
    dockerInterface.listActiveContainers((err, containers) => {
      expect(err).to.equal(null);
      expect(containers).to.be.ok;
      done();
    });
  });

  it('can get the stats stream for a given docker container', (done) => {
    dockerInterface.listActiveContainers((err, containers) => {
      if (err) {
        throw err;
      }
      containers.forEach((container) => {
        if (container.Status.indexOf('Up') > -1) {
          dockerInterface.getResourceStream(container.Id, (err2, stream) => {
            if (err2) {
              throw err2;
            }
            expect(stream.on).to.be.ok;
            done();
          });
        }
      });
    });
  });
});

describe('StreamWatcher', function() {
  let containerId;
  let statStream;
  beforeEach((done) => {
    // call this just to get a valid docker id:
    let found = false;
    dockerInterface.listActiveContainers((err, containers) => {
      if (err) {
        throw err;
      }
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        if (!found && container.Status.indexOf('Up') > -1) {
          found = true;
          containerId = container.Id;
          dockerInterface.getResourceStream(container.Id, (err2, stream) => {
            statStream = stream;
            return done();
          });
        }
      }
    });
  });
  it('can launch a stream watcher', (done) => {
    const log = () => {};
    const options = {
      cpu: {
        threshold: 0,
        duration: 2000
      }
    };
    const testWatcher = new ContainerWatcher(containerId, statStream, log, options);
    expect(testWatcher.stream).to.be.ok;
    expect(testWatcher.cpuHistory).to.not.equal(undefined);
    done();
  });
  this.timeout(10000);
  it('can monitor a stream instance', (done) => {
    let handlerCalled = false;
    const options = {
      cpu: {
        threshold: 0,
        duration: 1000
      }
    };
    const log = () => {
      handlerCalled = true;
    };
    const testWatcher = new ContainerWatcher(containerId, statStream, log, options);
    testWatcher.watch();
    setTimeout(() => {
      expect(handlerCalled).to.equal(true);
      done();
    }, 2500);
  });
  it('can monitor a CPU resource in a stream instance', (done) => {
    const prevTags = [];
    const prevData = [];
    const log = (tags, data) => {
      prevTags.push(tags);
      prevData.push(data);
    };
    const testWatcher = new ContainerWatcher(containerId, statStream, log, {
      // if over 0 for more than 1 seconds:
      cpu: {
        threshold: 0,
        duration: 1000
      }
    });
    testWatcher.watch();
    setTimeout(() => {
      expect(prevTags.length).to.not.equal(0);
      done();
    }, 3000);
  });
});

describe('CPUHistory', () => {
  it('can initalize a CPU history and add items to it', (done) => {
    const cpuHistory = new CPUHistory('test watcher', {
      threshold: 0,
      duration: 1000
    });
    cpuHistory.update({
      read: '2016-08-12T19:35:33.134871873-05:00',
      precpu_stats:
      {
        cpu_usage:
           { total_usage: 503583300894,
             percpu_usage: [Object],
             usage_in_kernelmode: 25920000000,
             usage_in_usermode: 160280000000 },
        system_cpu_usage: 91145010000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } },
      cpu_stats:
          { cpu_usage:
           { total_usage: 503589280517,
             percpu_usage: [Object],
             usage_in_kernelmode: 25920000000,
             usage_in_usermode: 160290000000 },
        system_cpu_usage: 91145990000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } }
    });
    expect(cpuHistory.cpuHistory).to.be.ok;
    expect(Object.keys(cpuHistory.cpuHistory).length).to.be.greaterThan(0);
    expect(cpuHistory.cpuHistory['1471048533134']).to.be.greaterThan(0);
    expect(cpuHistory.amountOfTimeInViolation).to.be.greaterThan(0);
    done();
  });
  it('can monitor and report on pertinent CPU updates', (done) => {
    const cpuHistory = new CPUHistory('test watcher', {
      threshold: 0,
      duration: 1000
    });
    cpuHistory.update({
      read: '2016-08-12T19:35:33.134871873-05:00',
      precpu_stats:
      {
        cpu_usage:
         { total_usage: 503583300894,
           percpu_usage: [Object],
           usage_in_kernelmode: 25920000000,
           usage_in_usermode: 160280000000 },
        system_cpu_usage: 91145010000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 }
      },
      cpu_stats:
          { cpu_usage:
           { total_usage: 503589280517,
             percpu_usage: [Object],
             usage_in_kernelmode: 25920000000,
             usage_in_usermode: 160290000000 },
        system_cpu_usage: 91145990000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } }
    });
    cpuHistory.update({
      read: '2016-08-12T19:35:33.134871873-05:00',
      precpu_stats:
      {
        cpu_usage:
         { total_usage: 503583300894,
           percpu_usage: [Object],
           usage_in_kernelmode: 25920000000,
           usage_in_usermode: 160280000000 },
        system_cpu_usage: 91145010000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } },
      cpu_stats:
        { cpu_usage:
         { total_usage: 503589280517,
           percpu_usage: [Object],
           usage_in_kernelmode: 25920000000,
           usage_in_usermode: 160290000000 },
        system_cpu_usage: 91145990000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } }
    });
    const prevTags = [];
    const prevData = [];
    const log = (tags, data) => {
      prevTags.push(tags);
      prevData.push(data);
    };
    expect(cpuHistory.amountOfTimeInViolation).to.be.greaterThan(0);
    cpuHistory.report(log);
    expect(prevTags[0]).to.include('test watcher');
    cpuHistory.update({
      read: '2016-08-12T19:35:40.134871873-05:00',
      precpu_stats:
      {
        cpu_usage:
         { total_usage: 503583300894,
           percpu_usage: [Object],
           usage_in_kernelmode: 25920000000,
           usage_in_usermode: 160280000000 },
        system_cpu_usage: 91145010000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } },
      cpu_stats:
        { cpu_usage:
         { total_usage: 503589280517,
           percpu_usage: [Object],
           usage_in_kernelmode: 25920000000,
           usage_in_usermode: 160290000000 },
        system_cpu_usage: 91145990000000,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } }
    });
    // should not keep posting:
    cpuHistory.report(log);
    expect(prevTags.length).to.equal(1);
    cpuHistory.update({
      read: '2016-08-12T19:35:40.134871873-05:00',
      precpu_stats:
      {
        cpu_usage:
         { total_usage: 0,
           percpu_usage: [Object],
           usage_in_kernelmode: 0,
           usage_in_usermode: 0 },
        system_cpu_usage: 0,
        throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } },
      cpu_stats:
            { cpu_usage:
             { total_usage: 0,
               percpu_usage: [Object],
               usage_in_kernelmode: 0,
               usage_in_usermode: 0 },
          system_cpu_usage: 0,
          throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 } }
    });
    cpuHistory.report(log);
    // should post that we've gone back to nromal
    expect(prevTags.length).to.equal(2);
    done();
  });
});

describe('DockerWatcher', function() {
  this.timeout(6000);
  let containerId;
  beforeEach((done) => {
    // call this just to get a valid docker id:
    let found = false;
    dockerInterface.listActiveContainers((err, containers) => {
      if (err) {
        throw err;
      }
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        if (!found && container.Status.indexOf('Up') > -1) {
          found = true;
          containerId = container.Id;
          return done();
        }
      }
    });
  });

  it('can initialize a DockerWatcher', (done) => {
    const options = {};
    let loggedTags;
    let loggedData;
    options[containerId] = {
      cpu: {
        threshold: 50,
        duration: 0
      }
    };
    const log = (tags, data) => {
      loggedTags = tags;
      loggedData = data;
    };
    const dw = new DockerWatcher('Test Watcher 1', options, log);
    expect(loggedTags).to.include('Test Watcher 1');
    expect(loggedData).to.include('initialized');
    expect(dw.options[containerId].cpu.threshold).to.equal(50);
    done();
  });

  it('can launch a DockerWatcher and it will monitor streams', (done) => {
    const options = {};
    const loggedTags = [];
    const loggedData = [];
    options[containerId] = {
      cpu: {
        threshold: 0,
        duration: 1000
      }
    };
    const log = (tags, data) => {
      loggedTags.push(tags);
      loggedData.push(data);
    };
    const dw = new DockerWatcher('Test Watcher 1', options, log);
    dw.startAll();
    setTimeout(() => {
      expect(loggedTags.length).to.equal(4);
      expect(loggedData[3]).to.include('CPU above');
      done();
    }, 2500);
  });
});
