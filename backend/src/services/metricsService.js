/**
 * Metrics Service — Business Logic for Metric Data
 * 
 * This is where data gets processed AFTER the API validates it.
 * 
 * Responsibilities:
 * 1. Register/update the server that sent the metrics
 * 2. Extract key values (CPU, memory, disk) for fast querying
 * 3. Store the full payload in PostgreSQL
 * 4. Emit the data via WebSocket for real-time dashboard updates
 * 
 * Why separate service from route?
 * Routes handle HTTP concerns (request/response).
 * Services handle business logic (can be called from routes, workers, tests).
 * This separation makes the code testable and reusable.
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class MetricsService {

  /**
   * Process incoming metrics from an agent
   * This is the main entry point called by the API route
   */
  async ingestMetrics(payload) {
    const { serverId, serverName, timestamp, metrics } = payload;

    // Step 1: Ensure the server is registered (upsert pattern)
    await this.upsertServer(serverId, serverName, metrics);

    // Step 2: Extract headline numbers for indexed columns
    const cpuUsage = metrics.cpu?.currentLoad || 0;
    const memoryUsage = metrics.memory?.usagePercent || 0;
    const diskUsage = this.getMaxDiskUsage(metrics.disk);

    // Step 3: Store the metric record
    const id = uuidv4();
    await db('metrics')
      .insert({
        id,
        server_id: serverId,
        cpu_usage: cpuUsage,
        memory_usage: memoryUsage,
        disk_usage: diskUsage,
        full_metrics: JSON.stringify(metrics),
        recorded_at: timestamp || new Date().toISOString(),
      });

    logger.debug(`Metric stored for ${serverId}: CPU=${cpuUsage}%, MEM=${memoryUsage}%`);

    return {
      id,
      cpu_usage: cpuUsage,
      memory_usage: memoryUsage,
      disk_usage: diskUsage,
    };
  }

  /**
   * Register or update a server's record
   * "Upsert" = INSERT if new, UPDATE if exists
   * 
   * This way agents don't need a separate registration step —
   * they just start sending data and the server auto-registers.
   */
  async upsertServer(serverId, serverName, metrics) {
    const existing = await db('servers').where({ server_id: serverId }).first();

    if (existing) {
      // Server exists — update last_seen and status
      await db('servers').where({ server_id: serverId }).update({
        name: serverName,
        status: 'online',
        last_seen_at: new Date().toISOString(),
        os_platform: metrics.os?.platform,
        os_distro: metrics.os?.distro,
        os_release: metrics.os?.release,
        updated_at: new Date().toISOString(),
      });
    } else {
      // New server — register it
      await db('servers').insert({
        id: uuidv4(),
        server_id: serverId,
        name: serverName,
        status: 'online',
        last_seen_at: new Date().toISOString(),
        os_platform: metrics.os?.platform,
        os_distro: metrics.os?.distro,
        os_release: metrics.os?.release,
      });
      logger.info(`New server registered: ${serverId} (${serverName})`);
    }
  }

  /**
   * Get the highest disk usage across all partitions
   * We care most about the fullest disk (that's the one about to cause problems)
   */
  getMaxDiskUsage(diskArray) {
    if (!Array.isArray(diskArray) || diskArray.length === 0) return 0;
    return Math.max(...diskArray.map(d => d.usagePercent || 0));
  }

  /**
   * Query metrics for a specific server within a time range
   * Used by the dashboard to render charts
   */
  async getMetrics(serverId, { from, to, limit = 100 } = {}) {
    let query = db('metrics')
      .where({ server_id: serverId })
      .orderBy('recorded_at', 'desc')
      .limit(limit);

    if (from) query = query.where('recorded_at', '>=', from);
    if (to) query = query.where('recorded_at', '<=', to);

    return query;
  }

  /**
   * Get the latest metric for each server (dashboard overview)
   */
  async getLatestMetrics() {
    // Subquery: get the max recorded_at per server
    const latestPerServer = await db('metrics')
      .select('server_id')
      .max('recorded_at as latest')
      .groupBy('server_id');

    if (latestPerServer.length === 0) return [];

    // Fetch full records for those timestamps
    const results = [];
    for (const { server_id, latest } of latestPerServer) {
      const record = await db('metrics')
        .where({ server_id, recorded_at: latest })
        .first();
      if (record) results.push(record);
    }

    return results;
  }

  /**
   * Get all registered servers with their status
   */
  async getServers() {
    return db('servers').orderBy('last_seen_at', 'desc');
  }

  /**
   * Get a single server by its server_id
   */
  async getServer(serverId) {
    return db('servers').where({ server_id: serverId }).first();
  }
}

module.exports = new MetricsService();
