/**
 * Alerts Service — Business Logic for Alert Management
 * 
 * Creates, queries, and updates alert lifecycle (active → acknowledged → resolved).
 * Both machine-generated (AI engine) and rule-based detectors call this service.
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class AlertsService {

  /**
   * Create a new alert
   */
  async createAlert({ severity, type, title, message, source, serverId, websiteUrl, context }) {
    const id = uuidv4();

    await db('alerts').insert({
      id,
      severity,
      type,
      title,
      message,
      source: source || 'system',
      server_id: serverId || null,
      website_url: websiteUrl || null,
      context: context ? JSON.stringify(context) : null,
      status: 'active',
    });

    logger.warn(`🚨 Alert created [${severity.toUpperCase()}]: ${title}`);

    return { id, severity, type, title, message, status: 'active' };
  }

  /**
   * Get alerts with filtering
   */
  async getAlerts({ status, severity, serverId, limit = 50, offset = 0 } = {}) {
    let query = db('alerts')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (status) query = query.where({ status });
    if (severity) query = query.where({ severity });
    if (serverId) query = query.where({ server_id: serverId });

    return query;
  }

  /**
   * Get active alert count (for KPI card on dashboard)
   */
  async getActiveCount() {
    const result = await db('alerts')
      .where({ status: 'active' })
      .count('* as count')
      .first();
    return parseInt(result.count, 10);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, acknowledgedBy = 'admin') {
    await db('alerts').where({ id: alertId }).update({
      status: 'acknowledged',
      acknowledged_by: acknowledgedBy,
      acknowledged_at: new Date().toISOString(),
    });

    return { id: alertId, status: 'acknowledged' };
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId) {
    await db('alerts').where({ id: alertId }).update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    });

    return { id: alertId, status: 'resolved' };
  }

  /**
   * Get alert statistics (for dashboard)
   */
  async getAlertStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, active, todayCount] = await Promise.all([
      db('alerts').count('* as count').first(),
      db('alerts').where({ status: 'active' }).count('* as count').first(),
      db('alerts').where('created_at', '>=', today.toISOString()).count('* as count').first(),
    ]);

    return {
      total: parseInt(total.count, 10),
      active: parseInt(active.count, 10),
      today: parseInt(todayCount.count, 10),
    };
  }
}

module.exports = new AlertsService();
