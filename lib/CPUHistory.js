'use strict';

// tracks/calculates cpu levels and does appropriate notifications:
class CPUHistory {
  constructor(watcherName, options) {
    this.watcherName = watcherName;
    this.cpuHistory = {};
    this.alertsHistory = {};
    this.options = options;
    this.enteredViolationStateAt = -1; // set
    this.amountOfTimeInViolation = 0;
    this.violationAlertSent = false;
    this.alarmTriggered = false;
  }
  // update status and report back any log updates:
  update(item) {
    const cpuPercent = this.calculateCPUPercent(item);
    if (cpuPercent > this.options.threshold) {
      // if we're in normal state and go to violation:
      if (this.enteredViolationStateAt < 0) {
        this.enteredViolationStateAt = new Date(item.read).getTime();
      }
      this.amountOfTimeInViolation = new Date().getTime() - this.enteredViolationStateAt;
    } else {
      // if we're in violation state and go to normal:
      if (this.enteredViolationStateAt > 0) {
        this.enteredViolationStateAt = -1;
      }
      this.amountOfTimeInViolation = 0;
    }
    this.cpuHistory[new Date(item.read).getTime()] = cpuPercent;
  }
  // report any current warnings/errors/logs:
  report(log) {
    if (this.amountOfTimeInViolation > this.options.duration && !this.violationAlertSent) {
      this.violationAlertSent = true;
      log([this.watcherName, 'warning'], `CPU above ${this.options.threshold} for ${this.options.duration} ms`);
    }
    if (this.amountOfTimeInViolation < this.options.duration && this.violationAlertSent) {
      this.violationAlertSent = false;
      log([this.watcherName, 'info'], 'CPU returned to normal');
    }
  }
  calculateCPUPercent(item) {
    const cpuDelta = item.cpu_stats.cpu_usage.total_usage - item.precpu_stats.cpu_usage.total_usage;
    const systemDelta = item.cpu_stats.system_cpu_usage - item.precpu_stats.system_cpu_usage;
    return cpuDelta / systemDelta * 100;
  }
}
//todo: class MemoryHistory, NetworkHistory

module.exports = CPUHistory;
