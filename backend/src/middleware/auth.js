/**
 * Authentication Middleware
 * 
 * Two types of auth in this system:
 * 1. JWT tokens — for human users accessing the dashboard
 * 2. API keys — for agents sending metrics (simpler, machine-to-machine)
 * 
 * Why two? Agents don't need user sessions. They just need to prove
 * "I'm an authorized agent." A simple API key in the header does that.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');

/**
 * Verify JWT token for dashboard users
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid JWT token attempt', { ip: req.ip });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Verify API key for agent data submissions
 */
function authenticateAgent(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== config.agent.apiKey) {
    logger.warn('Invalid agent API key attempt', { ip: req.ip });
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = { authenticateToken, authenticateAgent };
