/**
 * Auth API Routes
 *
 * POST /auth/login     — email + password → JWT access + refresh tokens
 * POST /auth/refresh   — refresh token → new access token
 * POST /auth/logout    — invalidate refresh token
 * GET  /auth/me        — get current user info (requires JWT)
 *
 * Rate limiting is extra strict on auth routes (brute-force protection).
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../config/logger');

// Strict rate limit on auth endpoints: max 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  skipSuccessfulRequests: true, // Only count failed requests
});

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(1).required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * POST /api/v1/auth/login
 *
 * Flow:
 * 1. Validate input format
 * 2. Call authService.login (checks DB, bcrypt comparison, lockout)
 * 3. Return tokens — client stores them
 *
 * Security: Never say WHY login failed (don't reveal if email exists)
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Invalid email or password format' });
    }

    const result = await authService.login(value.email, value.password);

    res.json({
      message: 'Login successful',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (err) {
    // All login failures return 401 with the same generic message structure
    // This prevents timing-based user enumeration attacks
    logger.warn(`Login failed: ${req.body.email} from ${req.ip} — ${err.message}`);
    res.status(401).json({ error: err.message });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Exchange a refresh token for a new access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const result = await authService.refreshAccessToken(value.refreshToken);
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Invalidates the user's refresh token server-side
 */
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user's info
 */
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;
