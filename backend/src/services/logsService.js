/**
 * Logs Service — Business Logic for Log Data
 * 
 * Handles ingestion of log entries from agents.
 * 
 * Log collection works like this:
 * 1. Agent watches log files (tailing) on the server
 * 2. New log lines are sent to this service in batches
 * 3. We parse severity, store them, and later feed to AI for analysis
 * 
 * Severity parsing: If the agent didn't classify the log, we try to
 * auto-detect severity from keywords in the message:
 *   "error" / "fail" / "fatal" → error
 *   "warn" → warning  
 *   "debug" → debug
 *   everything else → info
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class LogsService {

  /**
   * Ingest a batch of log entries from an agent
   */
  async ingestLogs(serverId, logs) {
    if (!Array.isArray(logs) || logs.length === 0) {
      return { inserted: 0 };
    }

    const records = logs.map(log => ({
      id: uuidv4(),
      server_id: serverId,
      source: log.source || 'unknown',
      severity: log.severity || this.detectSeverity(log.message),
      message: log.message,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null,
      logged_at: log.timestamp || new Date().toISOString(),
    }));

    // Batch insert for efficiency (instead of one-at-a-time)
    await db('logs').insert(records);

    logger.debug(`Stored ${records.length} log entries from ${serverId}`);

    // AI Threat Analysis for Logs
    try {
      const aiEngine = require('../ai');
      const threats = aiEngine.patternMatcher.analyzeLogs(records);
      
      if (threats.length > 0) {
        // We'll optionally need an io object. The LogsService doesn't have it natively,
        // but it might not be critical to pass it here if we refactor or we can just pass null
        // because the routes handle the WebSocket emission later. 
        // Or we could rethink how we reach io. We will pass null for now.
        await aiEngine.threatScorer.processLogThreats(serverId, threats, null);
      }
    } catch (err) {
      logger.error(`AI Analysis failed for logs on ${serverId}: ${err.message}`);
    }

    return { inserted: records.length };
  }

  /**
   * Auto-detect log severity from message content
   * This is a simple heuristic — the AI engine will do deeper analysis later
   */
  detectSeverity(message) {
    if (!message) return 'info';
    const lower = message.toLowerCase();

    if (lower.includes('fatal') || lower.includes('critical') || lower.includes('emergency')) return 'critical';
    if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) return 'error';
    if (lower.includes('warn')) return 'warning';
    if (lower.includes('debug') || lower.includes('trace')) return 'debug';
    return 'info';
  }

  /**
   * Query logs for a server with filtering
   */
  async getLogs({ serverId, severity, source, from, to, limit = 100, offset = 0 } = {}) {
    let query = db('logs').orderBy('logged_at', 'desc').limit(limit).offset(offset);

    if (serverId) query = query.where({ server_id: serverId });
    if (severity) query = query.where({ severity });
    if (source) query = query.where({ source });
    if (from) query = query.where('logged_at', '>=', from);
    if (to) query = query.where('logged_at', '<=', to);

    return query;
  }

  /**
   * Get recent error/critical logs (for the alert feed)
   */
  async getRecentCriticalLogs(limit = 20) {
    return db('logs')
      .whereIn('severity', ['error', 'critical'])
      .orderBy('logged_at', 'desc')
      .limit(limit);
  }

  /**
   * Count logs by severity for a time period (dashboard stats)
   */
  async getLogStats(from, to) {
    let query = db('logs')
      .select('severity')
      .count('* as count')
      .groupBy('severity');

    if (from) query = query.where('logged_at', '>=', from);
    if (to) query = query.where('logged_at', '<=', to);

    return query;
  }
}

module.exports = new LogsService();
