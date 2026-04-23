/**
 * ============================================
 *   AI Security Dashboard — Server Agent
 * ============================================
 * 
 * This is a LIGHTWEIGHT script that runs on every server you want to monitor.
 * 
 * What it does:
 * 1. Collects system metrics (CPU, memory, disk, network) every N seconds
 * 2. Watches log files for new entries
 * 3. Sends everything to the backend API
 * 
 * Think of it like a thermometer strapped to a patient — it just
 * reads vitals and reports them to the nurse's station.
 * 
 * It should be:
 * - Lightweight (minimal CPU/memory footprint)
 * - Resilient (retries if the backend is unreachable)
 * - Configurable (which metrics, which logs, how often)
 */

const os = require('os');
const dotenv = require('dotenv');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { collectSystemMetrics } = require('./collectors/system');
const LogWatcher = require('./collectors/logWatcher');
const { sendMetrics } = require('./transport/sender');
const logger = require('./utils/logger');

// ---- Agent Configuration ----
const AGENT_CONFIG = {
  serverId: process.env.AGENT_SERVER_ID || `server-${os.hostname()}`,
  serverName: process.env.AGENT_SERVER_NAME || os.hostname(),
  apiUrl: process.env.AGENT_API_URL || 'http://localhost:3001/api/v1',
  apiKey: process.env.AGENT_API_KEY || 'dev-agent-key',
  reportInterval: parseInt(process.env.AGENT_REPORT_INTERVAL, 10) || 10000, // 10 seconds
};

logger.info('═══════════════════════════════════════════');
logger.info('  AI Security Dashboard — Agent Starting');
logger.info('═══════════════════════════════════════════');
logger.info(`  Server ID:   ${AGENT_CONFIG.serverId}`);
logger.info(`  Server Name: ${AGENT_CONFIG.serverName}`);
logger.info(`  API URL:     ${AGENT_CONFIG.apiUrl}`);
logger.info(`  Interval:    ${AGENT_CONFIG.reportInterval}ms`);
logger.info('═══════════════════════════════════════════');

// ---- Initialize Log Watcher ----
const logWatcher = new LogWatcher(AGENT_CONFIG.apiUrl, AGENT_CONFIG.apiKey, AGENT_CONFIG.serverId);
const detectedLogs = LogWatcher.detectLogFiles();

if (detectedLogs.length > 0) {
  logger.info(`Found ${detectedLogs.length} default log files to watch.`);
  for (const log of detectedLogs) {
    logWatcher.watchFile(log.path, log.name);
  }
} else {
  logger.warn('No standard log files detected. Only metrics will be reported.');
}

// Start sending logs to backend
logWatcher.startFlushing();

// ---- Main Collection Loop (Metrics) ----
async function collectAndReport() {
  try {
    const metrics = await collectSystemMetrics();

    const payload = {
      serverId: AGENT_CONFIG.serverId,
      serverName: AGENT_CONFIG.serverName,
      timestamp: new Date().toISOString(),
      metrics,
    };

    await sendMetrics(AGENT_CONFIG.apiUrl, AGENT_CONFIG.apiKey, payload);
    logger.info(`✅ Reported ${Object.keys(metrics).length} metrics`);
  } catch (err) {
    logger.error(`❌ Collection/report failed: ${err.message}`);
    // Don't crash — just skip this cycle and try again next interval
  }
}

// Start the loop
setInterval(collectAndReport, AGENT_CONFIG.reportInterval);

// Run immediately on startup
collectAndReport();

logger.info('Agent is running. Press Ctrl+C to stop.');

// ---- Graceful Shutdown ----
process.on('SIGINT', () => {
  logger.info('\nStopping agent...');
  logWatcher.stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  logger.info('\nStopping agent...');
  logWatcher.stop();
  process.exit(0);
});
