'use strict';
const CPUHistory = require('./CPUHistory.js');
const defaultOptions = {
  cpu: {
    min: 0,
    max: 75
  }
};

// watches a single docker container for changes:
class ContainerWatcher {
  constructor(containerName, stream, log, options) {
    log([containerName], `Launching watcher for ${containerName}`);
    this.options = options || defaultOptions;
    this.stream = stream;
    this.containerName = containerName;
    this.log = log;
    if (options.cpu) {
      this.cpuHistory = new CPUHistory(containerName, options.cpu);
    }
    //todo:
    this.memoryHistory = null;
    this.networkHistory = null;
  }
  watchCpu(current) {
    this.cpuHistory.update(current);
    this.cpuHistory.report(this.log);
  }
  watch() {
    const handler = (data) => {
      const obj = JSON.parse(data.toString());
      this.watchCpu(obj);
      // todo:
      // this.watchMemory(obj);
      // this.watchNetwork(obj);
    };
    handler.bind(this);
    this.stream.on('data', handler);
  }
}
module.exports = ContainerWatcher;
