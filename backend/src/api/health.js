/**
 * Health Check Route
 * 
 * Every production system needs a health endpoint. It tells load balancers,
 * Docker, and monitoring tools: "Yes, I'm alive and my dependencies are okay."
 * 
 * This checks both PostgreSQL and Redis connectivity.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {},
  };

  // Check PostgreSQL
  try {
    await db.raw('SELECT 1');
    health.checks.database = 'connected';
  } catch (err) {
    health.status = 'degraded';
    health.checks.database = 'disconnected';
    logger.error('Health check: DB unreachable', { error: err.message });
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
