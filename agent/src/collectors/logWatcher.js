/**
 * Agent Log Watcher
 * 
 * HOW LOG TAILING WORKS:
 * 
 * Imagine a log file like a notebook where the OS keeps writing new lines.
 * "Tailing" means we start reading from the END and watch for NEW lines.
 * 
 * When a new line appears, we:
 * 1. Parse it (extract timestamp, severity, message)
 * 2. Buffer it (collect lines for a few seconds)
 * 3. Send the batch to the backend API
 * 
 * Why batch instead of sending each line immediately?
 * - A busy server can produce 100s of log lines per second
 * - Sending each one as a separate HTTP request would overwhelm the network
 * - Batching (e.g., every 5 seconds) is much more efficient
 * 
 * This module uses the 'tail' npm package which handles:
 * - File rotation (when the OS creates a new log file)
 * - File truncation (when logs are cleared)
 * - Efficient OS-level file watching (inotify on Linux, FSEvents on Mac)
 */

const { Tail } = require('tail');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class LogWatcher {
  constructor(apiUrl, apiKey, serverId) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.serverId = serverId;
    this.watchers = [];
    this.logBuffer = [];
    this.flushInterval = null;
    this.bufferIntervalMs = 5000;  // Send logs every 5 seconds
  }

  /**
   * Start watching a log file
   * @param {string} filePath - Absolute path to the log file
   * @param {string} sourceName - Friendly name (e.g., 'syslog', 'nginx/access')
   */
  watchFile(filePath, sourceName) {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(`Log file not found, skipping: ${filePath}`);
      return false;
    }

    try {
      const tail = new Tail(filePath, {
        follow: true,        // Keep following as file grows
        fromBeginning: false, // Start from end (don't read old logs)
        useWatchFile: true,   // Compatibility with Windows
        fsWatchOptions: { interval: 1000 },
      });

      tail.on('line', (line) => {
        if (line.trim()) {
          this.logBuffer.push({
            source: sourceName,
            message: line.trim(),
            severity: this.parseSeverity(line),
            timestamp: new Date().toISOString(),
            metadata: { file: filePath },
          });
        }
      });

      tail.on('error', (err) => {
        logger.error(`Log watcher error for ${filePath}: ${err.message}`);
      });

      this.watchers.push({ filePath, sourceName, tail });
      logger.info(`👁️  Watching log file: ${filePath} (as "${sourceName}")`);
      return true;

    } catch (err) {
      logger.error(`Failed to watch ${filePath}: ${err.message}`);
      return false;
    }
  }

  /**
   * Simple severity parsing from log line content
   */
  parseSeverity(line) {
    const lower = line.toLowerCase();
    if (lower.includes('fatal') || lower.includes('critical') || lower.includes('emergency')) return 'critical';
    if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) return 'error';
    if (lower.includes('warn')) return 'warning';
    if (lower.includes('debug') || lower.includes('trace')) return 'debug';
    return 'info';
  }

  /**
   * Start the buffer flush loop
   * Every N seconds, sends accumulated logs to the backend
   */
  startFlushing() {
    this.flushInterval = setInterval(() => this.flush(), this.bufferIntervalMs);
    logger.info(`📤 Log buffer flush interval: every ${this.bufferIntervalMs}ms`);
  }

  /**
   * Flush the log buffer — send to backend API
   */
  async flush() {
    if (this.logBuffer.length === 0) return;

    // Take the current buffer and clear it
    const batch = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const axios = require('axios');
      await axios.post(`${this.apiUrl}/logs`, {
        serverId: this.serverId,
        logs: batch,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        timeout: 5000,
      });

      logger.debug(`📤 Flushed ${batch.length} log entries to backend`);
    } catch (err) {
      logger.error(`Failed to flush logs: ${err.message}`);
      // Put logs back in buffer (don't lose them)
      this.logBuffer.unshift(...batch);
      // But cap the buffer to prevent memory issues
      if (this.logBuffer.length > 10000) {
        this.logBuffer = this.logBuffer.slice(-5000);
        logger.warn('Log buffer overflow — dropped oldest entries');
      }
    }
  }

  /**
   * Auto-detect common log file locations
   * Returns an array of { path, name } for discovered log files
   */
  static detectLogFiles() {
    const candidates = [];
    const os = require('os');

    if (os.platform() === 'win32') {
      // Windows log locations
      const windowsLogs = [
        { path: 'C:\\Windows\\System32\\LogFiles', name: 'windows-system' },
        { path: path.join(os.homedir(), 'AppData\\Local\\Temp'), name: 'windows-temp' },
      ];
      for (const log of windowsLogs) {
        if (fs.existsSync(log.path)) candidates.push(log);
      }
    } else {
      // Linux/Mac log locations
      const unixLogs = [
        { path: '/var/log/syslog', name: 'syslog' },
        { path: '/var/log/auth.log', name: 'auth.log' },
        { path: '/var/log/messages', name: 'messages' },
        { path: '/var/log/kern.log', name: 'kernel' },
        { path: '/var/log/nginx/access.log', name: 'nginx-access' },
        { path: '/var/log/nginx/error.log', name: 'nginx-error' },
        { path: '/var/log/apache2/access.log', name: 'apache-access' },
        { path: '/var/log/apache2/error.log', name: 'apache-error' },
      ];
      for (const log of unixLogs) {
        if (fs.existsSync(log.path)) candidates.push(log);
      }
    }

    return candidates;
  }

  /**
   * Stop all watchers
   */
  stop() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    for (const watcher of this.watchers) {
      watcher.tail.unwatch();
    }
    this.watchers = [];
    logger.info('Log watchers stopped');
  }
}

module.exports = LogWatcher;
