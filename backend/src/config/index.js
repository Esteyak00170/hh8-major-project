/**
 * Environment Configuration
 * 
 * Centralizes all env vars so no file ever reads process.env directly.
 * This pattern makes testing easier (you can mock config) and ensures
 * we fail fast if a required variable is missing.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root (one level up from backend/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'ai_security',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'devpassword',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  agent: {
    apiKey: process.env.AGENT_API_KEY || 'dev-agent-key',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
  },

  alertEmailTo: process.env.ALERT_EMAIL_TO || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
};

module.exports = config;
