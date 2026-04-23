const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { authenticateAgent, authenticateToken } = require('../middleware/auth');
const metricsService = require('../services/metricsService');
const { enqueueMetric } = require('../jobs/metricsWorker');
const logger = require('../config/logger');

// Validation schema for incoming metrics
const metricsSchema = Joi.object({
  serverId: Joi.string().required(),
  serverName: Joi.string().required(),
  timestamp: Joi.string().isoDate().optional(),
  metrics: Joi.object({
    cpu: Joi.object().optional(),
    memory: Joi.object().optional(),
    disk: Joi.alternatives(Joi.array(), Joi.object()).optional(),
    network: Joi.alternatives(Joi.array(), Joi.object()).optional(),
    topProcesses: Joi.array().optional(),
    os: Joi.object().optional(),
  }).required(),
});

/**
 * POST /api/v1/metrics — Agent sends metrics
 *
 * Uses job queue (BullMQ) for async processing if Redis is available.
 * Falls back to synchronous processing if Redis is unavailable.
 */
router.post('/', authenticateAgent, async (req, res, next) => {
  try {
    const { error, value } = metricsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Enqueue for processing (or process sync if queue unavailable)
    // Pass io so worker can broadcast WebSocket updates
    const io = req.app.get('io');
    await enqueueMetric(value, io);

    res.status(202).json({ message: 'Metric received', queued: true });
  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/v1/metrics — Query metrics for dashboard
 * Query params: serverId, from, to, limit
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { serverId, from, to, limit } = req.query;

    if (!serverId) {
      return res.status(400).json({ error: 'serverId query parameter is required' });
    }

    const metrics = await metricsService.getMetrics(serverId, {
      from, to,
      limit: parseInt(limit) || 100,
    });

    res.json({ metrics });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/metrics/latest — Latest metrics for all servers
 * Used by the dashboard overview page
 */
router.get('/latest', authenticateToken, async (req, res, next) => {
  try {
    const latestMetrics = await metricsService.getLatestMetrics();
    res.json({ metrics: latestMetrics });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
