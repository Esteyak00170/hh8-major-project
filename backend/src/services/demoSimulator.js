/**
 * Demo Simulator — Generates Realistic Test Data
 * 
 * WHY THIS EXISTS:
 * You can't test a monitoring system without data flowing through it.
 * Instead of waiting for real servers to send data, this simulator
 * creates realistic metric patterns that mimic real-world scenarios:
 * 
 * - Normal operation (CPU 20-45%, periodic spikes during backups)
 * - Gradual memory leak (memory slowly climbs over hours)
 * - DDoS attack (sudden CPU/network spike)
 * - Disk filling up (disk usage creeping toward 100%)
 * - Brute force login (rapid failed SSH attempts in logs)
 * 
 * This is how professional monitoring tools are tested internally.
 * It's also great for demos — stakeholders can see the dashboard
 * "in action" without needing a production environment.
 */

const axios = require('axios');
const logger = require('../config/logger');
const config = require('../config');

class DemoSimulator {
  constructor() {
    this.apiUrl = `http://localhost:${config.port}${config.apiPrefix}`;
    this.apiKey = config.agent.apiKey;
    this.isRunning = false;
    this.intervalId = null;
    this.tickCount = 0;

    // Simulated servers
    this.servers = [
      { id: 'prod-web-01', name: 'Production Web Server', baselineCpu: 35, baselineMem: 55 },
      { id: 'prod-web-02', name: 'Production Web Server 2', baselineCpu: 28, baselineMem: 48 },
      { id: 'db-primary', name: 'Primary Database', baselineCpu: 42, baselineMem: 72 },
      { id: 'api-gateway', name: 'API Gateway', baselineCpu: 22, baselineMem: 38 },
      { id: 'staging-01', name: 'Staging Server', baselineCpu: 15, baselineMem: 30 },
    ];

    // Simulated websites
    this.websites = [
      { url: 'https://www.google.com', name: 'Google (Reference)' },
      { url: 'https://github.com', name: 'GitHub (Reference)' },
      { url: 'https://httpstat.us/200', name: 'Test: Always 200' },
    ];
  }

  /**
   * Start the simulator
   * Sends data every 10 seconds, mimicking real agents
   */
  start(intervalMs = 10000) {
    if (this.isRunning) {
      logger.warn('Demo simulator is already running');
      return;
    }

    this.isRunning = true;
    this.tickCount = 0;

    logger.info('🎭 Demo Simulator STARTED — generating realistic test data');
    logger.info(`   Simulating ${this.servers.length} servers, ${this.websites.length} websites`);

    // Send initial data immediately
    this.tick();

    // Then repeat on interval
    this.intervalId = setInterval(() => this.tick(), intervalMs);
  }

  /**
   * Stop the simulator
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('🎭 Demo Simulator STOPPED');
  }

  /**
   * One simulation tick — sends metrics and logs for all servers
   */
  async tick() {
    this.tickCount++;
    
    for (const server of this.servers) {
      try {
        // Send simulated metrics
        const metrics = this.generateMetrics(server);
        await this.sendMetrics(server, metrics);

        // Occasionally send log entries (not every tick)
        if (this.tickCount % 3 === 0) {
          const logs = this.generateLogs(server);
          await this.sendLogs(server.id, logs);
        }
      } catch (err) {
        logger.error(`Simulator error for ${server.id}: ${err.message}`);
      }
    }
  }

  /**
   * Generate realistic metrics with patterns
   * 
   * The math here creates natural-looking data:
   * - Gaussian noise around a baseline (normal operation)
   * - Sinusoidal wave (simulates daily load patterns)
   * - Occasional spikes (simulates backups, deployments)
   */
  generateMetrics(server) {
    const t = this.tickCount;
    
    // Base + daily pattern + noise
    const dailyWave = Math.sin(t * 0.1) * 10;  // Slow wave ±10%
    const noise = (Math.random() - 0.5) * 8;    // Random noise ±4%
    
    // Occasional spike (every ~30 ticks, 10% chance -> updated for rapid testing)
    const spike = (Math.random() < 0.5) ? 60 + Math.random() * 20 : 0;

    const cpuLoad = Math.max(0, Math.min(100,
      server.baselineCpu + dailyWave + noise + spike
    ));

    // Memory: slowly rises for db-primary (simulating a leak)
    let memUsage = server.baselineMem + (Math.random() - 0.5) * 5;
    if (server.id === 'db-primary') {
      memUsage += (t * 0.2) % 20;  // Slow climb, resets every ~100 ticks
    }
    memUsage = Math.max(0, Math.min(100, memUsage));

    // Disk: slowly fills for prod-web-01 (log accumulation)
    let diskUsage = 45 + (Math.random() - 0.5) * 2;
    if (server.id === 'prod-web-01') {
      diskUsage = Math.min(95, 45 + (t * 0.15) % 40);
    }

    return {
      cpu: {
        currentLoad: Math.round(cpuLoad * 100) / 100,
        cpuCount: 8,
        loadAverage: [cpuLoad / 25, cpuLoad / 28, cpuLoad / 30],
      },
      memory: {
        totalMB: 16384,
        usedMB: Math.round((memUsage / 100) * 16384),
        freeMB: Math.round(((100 - memUsage) / 100) * 16384),
        usagePercent: Math.round(memUsage * 100) / 100,
      },
      disk: [{
        filesystem: '/dev/sda1',
        mount: '/',
        totalGB: 500,
        usedGB: Math.round((diskUsage / 100) * 500 * 100) / 100,
        usagePercent: Math.round(diskUsage * 100) / 100,
      }],
      network: [{
        interface: 'eth0',
        rxBytes: Math.round(Math.random() * 1000000000),
        txBytes: Math.round(Math.random() * 500000000),
        rxPerSec: Math.round(Math.random() * 10000000),
        txPerSec: Math.round(Math.random() * 5000000),
      }],
      topProcesses: [
        { name: 'node', pid: 1234, cpu: cpuLoad * 0.3, mem: memUsage * 0.2 },
        { name: 'postgres', pid: 5678, cpu: cpuLoad * 0.2, mem: memUsage * 0.3 },
        { name: 'nginx', pid: 910, cpu: cpuLoad * 0.1, mem: memUsage * 0.05 },
      ],
      os: {
        platform: 'linux',
        distro: 'Ubuntu',
        release: '22.04 LTS',
        uptime: t * 10 + 86400,  // Simulates uptime in seconds
      },
    };
  }

  /**
   * Generate realistic log entries
   * Mix of normal operations and occasional suspicious activity
   */
  generateLogs(server) {
    const logs = [];
    const now = new Date().toISOString();

    // Normal info log (always)
    logs.push({
      source: 'syslog',
      severity: 'info',
      message: `Health check passed for ${server.name}`,
      timestamp: now,
    });

    // Random application logs
    const appMessages = [
      { severity: 'info', message: 'Request processed successfully: GET /api/users (200)' },
      { severity: 'info', message: 'Cache hit ratio: 94.2% — performing well' },
      { severity: 'info', message: 'Database connection pool: 5/10 active connections' },
      { severity: 'warning', message: 'Slow query detected: SELECT * FROM orders took 2340ms' },
      { severity: 'warning', message: 'Memory usage approaching threshold: 78%' },
      { severity: 'error', message: 'Connection refused to cache server redis-01:6379' },
      { severity: 'error', message: 'Unhandled exception in /api/payments: TypeError: Cannot read property of undefined' },
    ];

    // Pick 1-3 random logs
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const msg = appMessages[Math.floor(Math.random() * appMessages.length)];
      logs.push({
        source: 'application',
        severity: msg.severity,
        message: msg.message,
        timestamp: now,
      });
    }

    // Suspicious activity (rare — ~5% chance)
    if (Math.random() < 0.05) {
      const suspiciousLogs = [
        { severity: 'critical', message: 'ALERT: Multiple failed SSH login attempts from 45.33.22.11 (15 attempts in 60 seconds)', source: 'auth.log' },
        { severity: 'critical', message: 'ALERT: Unusual outbound connection to 91.234.56.78:4444 detected', source: 'firewall' },
        { severity: 'error', message: 'Permission denied: unauthorized attempt to access /etc/shadow by user "www-data"', source: 'auth.log' },
        { severity: 'critical', message: 'ALERT: New crontab entry added by non-root user — possible persistence mechanism', source: 'syslog' },
        { severity: 'error', message: 'Suspicious process detected: /tmp/.hidden/miner consuming 95% CPU', source: 'syslog' },
      ];

      const suspicious = suspiciousLogs[Math.floor(Math.random() * suspiciousLogs.length)];
      logs.push({
        ...suspicious,
        timestamp: now,
        metadata: { ip: '45.33.22.11', flagged: true },
      });
    }

    return logs;
  }

  /**
   * Send metrics to the backend API
   */
  async sendMetrics(server, metrics) {
    await axios.post(`${this.apiUrl}/metrics`, {
      serverId: server.id,
      serverName: server.name,
      timestamp: new Date().toISOString(),
      metrics,
    }, {
      headers: { 'X-API-Key': this.apiKey },
      timeout: 5000,
    });
  }

  /**
   * Send logs to the backend API
   */
  async sendLogs(serverId, logs) {
    await axios.post(`${this.apiUrl}/logs`, {
      serverId,
      logs,
    }, {
      headers: { 'X-API-Key': this.apiKey },
      timeout: 5000,
    });
  }
}

module.exports = new DemoSimulator();
