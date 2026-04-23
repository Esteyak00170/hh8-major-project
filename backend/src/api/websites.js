/**
 * Websites API Routes
 * 
 * POST /websites — Add a website to monitor
 * GET /websites — Get latest check results for all websites
 * GET /websites/:url/history — Get check history for a specific website
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth');
const websiteMonitor = require('../services/websiteMonitorService');

// Validation schema
const addWebsiteSchema = Joi.object({
  url: Joi.string().uri().required(),
  name: Joi.string().optional(),
});

/**
 * POST /api/v1/websites — Add a website to monitor
 * Immediately runs the first health check
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = addWebsiteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await websiteMonitor.addWebsite(value.url, value.name);

    // Broadcast to dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('website:checked', result);
    }

    res.status(201).json({ check: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/websites — Latest status of all monitored websites
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const checks = await websiteMonitor.getLatestChecks();
    res.json({ websites: checks });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/websites/check-now — Trigger immediate check of all websites
 */
router.post('/check-now', authenticateToken, async (req, res, next) => {
  try {
    const results = await websiteMonitor.checkAllWebsites();
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
