/**
 * Logs API Routes
 * 
 * POST /logs — Agents send log entries here (batch)
 * GET /logs — Dashboard queries logs with filtering
 * GET /logs/stats — Log severity distribution
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { authenticateAgent, authenticateToken } = require('../middleware/auth');
const logsService = require('../services/logsService');
const logger = require('../config/logger');

// Validation schema for incoming logs
const logsSchema = Joi.object({
  serverId: Joi.string().required(),
  logs: Joi.array().items(Joi.object({
    source: Joi.string().required(),
    severity: Joi.string().valid('debug', 'info', 'warning', 'error', 'critical').optional(),
    message: Joi.string().required(),
    metadata: Joi.object().optional(),
    timestamp: Joi.string().isoDate().optional(),
  })).min(1).required(),
});

/**
 * POST /api/v1/logs — Agent sends log entries
 */
router.post('/', authenticateAgent, async (req, res, next) => {
  try {
    const { error, value } = logsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await logsService.ingestLogs(value.serverId, value.logs);

    // Broadcast critical logs to dashboard
    const io = req.app.get('io');
    if (io) {
      const criticalLogs = value.logs.filter(l =>
        ['error', 'critical'].includes(l.severity || logsService.detectSeverity(l.message))
      );
      if (criticalLogs.length > 0) {
        io.emit('log:critical', {
          serverId: value.serverId,
          logs: criticalLogs,
        });
      }
    }

    res.status(202).json({ message: `${result.inserted} log entries stored` });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/logs — Query logs with filters
 * Query params: serverId, severity, source, from, to, limit, offset
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { serverId, severity, source, from, to, limit, offset } = req.query;

    const logs = await logsService.getLogs({
      serverId, severity, source, from, to,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    });

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/logs/stats — Log severity distribution
 * Query params: from, to
 */
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const stats = await logsService.getLogStats(from, to);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
