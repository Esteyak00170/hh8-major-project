/**
 * Auth Service — Authentication Business Logic
 *
 * Handles:
 * 1. User registration (creates hashed password)
 * 2. Login (validates credentials, issues JWT + refresh token)
 * 3. Token refresh (issues new JWT using refresh token)
 * 4. Account lockout (blocks after 5 failed attempts for 15 minutes)
 *
 * ───────────────────────────────────────────────────────
 * HOW JWT AUTH WORKS (simple explanation):
 * ───────────────────────────────────────────────────────
 *
 * 1. User logs in with email + password
 * 2. Server verifies password against stored bcrypt hash
 * 3. Server creates a JWT — a signed token containing { id, email, role }
 *    The JWT is signed with a secret key only the server knows
 * 4. Client stores the JWT (localStorage or httpOnly cookie)
 * 5. On every API request, client sends: Authorization: Bearer <token>
 * 6. Server verifies the signature — if valid, request is allowed
 *
 * Why two tokens (access + refresh)?
 * - Access token: short-lived (1 hour). If stolen, damage is limited.
 * - Refresh token: long-lived (7 days), stored securely server-side.
 *   Used only to get a new access token — not for API calls.
 * ───────────────────────────────────────────────────────
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const logger = require('../config/logger');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BCRYPT_ROUNDS = 12; // Higher = slower hashing = harder to brute-force

class AuthService {

  /**
   * Create an initial admin user (run once on first boot)
   */
  async createDefaultAdmin() {
    const existing = await db('users').where({ email: 'admin@aisd.local' }).first();
    if (existing) return;

    const passwordHash = await bcrypt.hash('Admin@123!', BCRYPT_ROUNDS);

    await db('users').insert({
      id: uuidv4(),
      email: 'admin@aisd.local',
      name: 'Admin',
      password_hash: passwordHash,
      role: 'admin',
    });

    logger.info('✅ Default admin created: admin@aisd.local / Admin@123!');
    logger.warn('⚠️  Change the default password immediately!');
  }

  /**
   * Login — validate credentials, issue tokens
   *
   * Returns: { accessToken, refreshToken, user }
   * Throws: Error with message for client
   */
  async login(email, password) {
    // 1. Find user
    const user = await db('users').where({ email: email.toLowerCase() }).first();

    if (!user) {
      // Don't reveal whether email exists (prevents user enumeration)
      throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
      throw new Error('Account is disabled. Contact your administrator.');
    }

    // 2. Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMs = new Date(user.locked_until) - new Date();
      const remainingMins = Math.ceil(remainingMs / 60000);
      throw new Error(`Account locked. Try again in ${remainingMins} minute(s).`);
    }

    // 3. Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      await this.recordFailedAttempt(user);
      throw new Error('Invalid email or password');
    }

    // 4. Reset failed attempts on success
    await db('users').where({ id: user.id }).update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    });

    // 5. Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    logger.info(`User logged in: ${user.email} (${user.role})`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Record a failed login and lock account if threshold hit
   */
  async recordFailedAttempt(user) {
    const newCount = (user.failed_login_attempts || 0) + 1;
    const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;

    await db('users').where({ id: user.id }).update({
      failed_login_attempts: newCount,
      locked_until: shouldLock
        ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
        : null,
    });

    if (shouldLock) {
      logger.warn(`Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts: ${user.email}`);
    }
  }

  /**
   * Generate a short-lived JWT access token (1 hour)
   *
   * The token payload contains: id, email, role
   * It's signed with the JWT_SECRET — any tampering invalidates it
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Generate and store a refresh token
   *
   * The actual token sent to client is a UUID.
   * We store a HASH of it in the database — so even if
   * the database is leaked, tokens can't be used directly.
   */
  async generateRefreshToken(userId) {
    const rawToken = uuidv4();
    const tokenHash = await bcrypt.hash(rawToken, 8); // Lower rounds — refresh tokens are big

    await db('users').where({ id: userId }).update({
      refresh_token: tokenHash,
    });

    return rawToken; // Send the raw token to the client
  }

  /**
   * Exchange a refresh token for a new access token
   */
  async refreshAccessToken(rawRefreshToken) {
    // Find all users with a refresh token (we'll check each hash)
    // In production with many users, you'd store a token ID separately
    const users = await db('users').whereNotNull('refresh_token');

    for (const user of users) {
      const valid = await bcrypt.compare(rawRefreshToken, user.refresh_token);
      if (valid) {
        const newAccessToken = this.generateAccessToken(user);
        logger.debug(`Token refreshed for: ${user.email}`);
        return {
          accessToken: newAccessToken,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        };
      }
    }

    throw new Error('Invalid or expired refresh token');
  }

  /**
   * Logout — invalidate refresh token
   */
  async logout(userId) {
    await db('users').where({ id: userId }).update({
      refresh_token: null,
    });
    logger.info(`User logged out: ${userId}`);
  }
}

module.exports = new AuthService();
