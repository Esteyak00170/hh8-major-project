/**
 * Servers API Routes — Rich Detail Views
 *
 * GET /servers              — List all servers with live status + summary stats
 * GET /servers/:id          — Full server detail (history, uptime %, trends)
 * GET /servers/:id/metrics  — Time-series metrics for chart rendering
 * GET /servers/:id/logs     — Recent logs for a specific server
 * PATCH /servers/:id/status — Manually set server status (maintenance mode)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const metricsService = require('../services/metricsService');
const logsService = require('../services/logsService');
const alertsService = require('../services/alertsService');
const db = require('../config/database');

// GET /api/v1/servers — enriched server list
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const servers = await metricsService.getServers();

    // Enrich each server with latest metrics and alert count
    const enriched = await Promise.all(servers.map(async (server) => {
      const latest = await db('metrics')
        .where({ server_id: server.server_id })
        .orderBy('recorded_at', 'desc')
        .first();

      const activeAlerts = await db('alerts')
        .where({ server_id: server.server_id, status: 'active' })
        .count('* as count')
        .first();

      return {
        ...server,
        cpuUsage: latest?.cpu_usage || null,
        memoryUsage: latest?.memory_usage || null,
        diskUsage: latest?.disk_usage || null,
        lastMetricAt: latest?.recorded_at || null,
        activeAlertCount: parseInt(activeAlerts?.count || 0, 10),
      };
    }));

    res.json({ servers: enriched });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/servers/:id — full server detail
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const server = await metricsService.getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    // Calculate uptime percentage (last 24 hours)
    const uptimeStats = await calculateUptimeStats(req.params.id);

    // Get averages over last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const avgMetrics = await db('metrics')
      .where({ server_id: req.params.id })
      .where('recorded_at', '>=', oneHourAgo)
      .avg({
        avgCpu: 'cpu_usage',
        avgMemory: 'memory_usage',
        avgDisk: 'disk_usage',
      })
      .first();

    // Peak values (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const peakMetrics = await db('metrics')
      .where({ server_id: req.params.id })
      .where('recorded_at', '>=', oneDayAgo)
      .max({ peakCpu: 'cpu_usage', peakMemory: 'memory_usage' })
      .first();

    // Active alerts
    const alerts = await db('alerts')
      .where({ server_id: req.params.id })
      .whereIn('status', ['active', 'acknowledged'])
      .orderBy('created_at', 'desc')
      .limit(10);

    res.json({
      server,
      stats: {
        uptime24h: uptimeStats,
        lastHour: {
          avgCpu: Math.round((avgMetrics?.avgCpu || 0) * 100) / 100,
          avgMemory: Math.round((avgMetrics?.avgMemory || 0) * 100) / 100,
          avgDisk: Math.round((avgMetrics?.avgDisk || 0) * 100) / 100,
        },
        last24h: {
          peakCpu: Math.round((peakMetrics?.peakCpu || 0) * 100) / 100,
          peakMemory: Math.round((peakMetrics?.peakMemory || 0) * 100) / 100,
        },
      },
      activeAlerts: alerts,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/servers/:id/metrics — time-series data for charting
router.get('/:id/metrics', authenticateToken, async (req, res, next) => {
  try {
    const { from, to, limit } = req.query;
    const metrics = await metricsService.getMetrics(req.params.id, {
      from,
      to,
      limit: parseInt(limit) || 100,
    });

    // Format for Chart.js consumption
    const chartData = {
      labels: metrics.map(m => m.recorded_at).reverse(),
      cpu: metrics.map(m => m.cpu_usage).reverse(),
      memory: metrics.map(m => m.memory_usage).reverse(),
      disk: metrics.map(m => m.disk_usage).reverse(),
    };

    res.json({ metrics, chartData });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/servers/:id/logs — recent logs for one server
router.get('/:id/logs', authenticateToken, async (req, res, next) => {
  try {
    const { severity, limit, offset } = req.query;
    const logs = await logsService.getLogs({
      serverId: req.params.id,
      severity,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

/**
 * Helper: Calculate uptime percentage for the last 24 hours
 *
 * Uptime % = (minutes server was online / 1440 total minutes) × 100
 *
 * "Online" = reported metrics at least once every 5-minute window
 */
async function calculateUptimeStats(serverId) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const totalWindowMinutes = 24 * 60; // 1440 minutes
  const windowSizeMinutes = 5;
  const totalWindows = totalWindowMinutes / windowSizeMinutes; // 288 windows

  // Count distinct 5-minute windows with at least one metric report
  const metrics = await db('metrics')
    .where({ server_id: serverId })
    .where('recorded_at', '>=', oneDayAgo.toISOString())
    .select('recorded_at');

  // Group into 5-minute buckets
  const windowsWithData = new Set();
  for (const metric of metrics) {
    const ts = new Date(metric.recorded_at).getTime();
    const windowIndex = Math.floor((ts - oneDayAgo.getTime()) / (windowSizeMinutes * 60 * 1000));
    windowsWithData.add(windowIndex);
  }

  const uptimePct = Math.min(100, Math.round((windowsWithData.size / totalWindows) * 10000) / 100);

  return {
    percentLast24h: uptimePct,
    windowsOnline: windowsWithData.size,
    totalWindows,
  };
}

module.exports = router;
