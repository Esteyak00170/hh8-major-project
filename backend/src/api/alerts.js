/**
 * Alerts API Routes — Fully implemented
 *
 * GET  /alerts            — List alerts (filterable)
 * GET  /alerts/stats      — Count stats for dashboard KPIs
 * PATCH /alerts/:id/acknowledge — Mark alert seen
 * PATCH /alerts/:id/resolve     — Mark alert resolved
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const alertsService = require('../services/alertsService');

// GET /api/v1/alerts/stats — summary counts for dashboard
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const stats = await alertsService.getAlertStats();
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/alerts
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, severity, serverId, limit, offset } = req.query;
    const alerts = await alertsService.getAlerts({
      status, severity,
      serverId,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/alerts/:id/acknowledge
router.patch('/:id/acknowledge', authenticateToken, async (req, res, next) => {
  try {
    const result = await alertsService.acknowledgeAlert(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/alerts/:id/resolve
router.patch('/:id/resolve', authenticateToken, async (req, res, next) => {
  try {
    const result = await alertsService.resolveAlert(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
