'use strict';
const ContainerWatcher = require('./ContainerWatcher.js');
const dockerInterface = require('./dockerInterface.js');
// watches and manages all docker containers on a single docker:
class DockerWatcher {
  constructor(watcherName, options, log) {
    // todo: default options:
    this.watcherName = watcherName;
    this.options = options;
    this.activeContainerWatches = {};
    this.log = log;
    log([watcherName], 'Watcher initialized');
  }

  updateActiveContainers() {
    const activeContainerWatches = this.activeContainerWatches;
    const log = this.log;
    const options = this.options;
    const handleContainers = (err, containers) => {
      if (err) {
        throw err;
      }
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        if (container.Status.indexOf('Up') > -1) {
          // if it's up, make sure it's being watched:
          if (!activeContainerWatches[container.Id]) {
            dockerInterface.getResourceStream(container.Id, (err2, stream) => {
              if (err2) {
                throw err2;
              }
              if (options[container.Id]) {
                activeContainerWatches[container.Id] = new ContainerWatcher(container.Id, stream, log, options[container.Id]);
              } else {
                activeContainerWatches[container.Id] = new ContainerWatcher(container.Id, stream, log, options);
              }
              activeContainerWatches[container.Id].watch();
            });
            log(['info', this.watcherName], `Container ${container.Id} is now ${container.Status}`);
          }
        } else {
          // if it's suddenly not up but was previously, notify:
          if (activeContainerWatches[container.Id]) {
            activeContainerWatches[container.Id].stop(() => {
              activeContainerWatches[container.Id] = undefined;
              log(['warning', this.watcherName], `Container ${container.Id} is no longer 'Up'`);
            });
          }
        }
      }
    };
    dockerInterface.listActiveContainers(handleContainers);
  }
  startAll() {
    this.updateActiveContainers();
  }
  stopAll() {
    // todo
  }
}
module.exports = DockerWatcher;
