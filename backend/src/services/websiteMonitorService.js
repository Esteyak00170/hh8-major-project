/**
 * Website Monitor Service
 * 
 * This is the "perimeter guard" — it periodically checks your websites
 * to ensure they're alive, fast, and secure.
 * 
 * How monitoring works under the hood:
 * 
 * 1. We send an HTTP GET request to the website
 * 2. We measure:
 *    - Response time (how long until we get a response)
 *    - Status code (200 = good, 4xx/5xx = bad)
 *    - SSL certificate validity and expiry date
 *    - Response headers (for security header analysis later)
 * 3. Results are stored in the database
 * 4. If something is wrong, an alert is generated
 * 
 * This runs on a cron schedule (every 1 minute by default).
 * 
 * Fun fact: This is essentially what services like UptimeRobot and
 * Pingdom do — but we own the data and can feed it to our AI engine.
 */

const axios = require('axios');
const tls = require('tls');
const { URL } = require('url');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../config/logger');

class WebsiteMonitorService {

  constructor() {
    // Default websites to monitor (can be configured via API later)
    this.websites = [];
  }

  /**
   * Load websites from database or config
   */
  async loadWebsites() {
    // Get unique URLs from previous checks, or use configured list
    const dbSites = await db('website_checks')
      .distinct('url', 'name')
      .orderBy('url');
    
    if (dbSites.length > 0) {
      this.websites = dbSites.map(s => ({ url: s.url, name: s.name }));
    }

    return this.websites;
  }

  /**
   * Add a website to the monitoring list
   */
  async addWebsite(url, name) {
    // Normalize URL
    if (!url.startsWith('http')) url = `https://${url}`;
    
    const exists = this.websites.find(w => w.url === url);
    if (!exists) {
      this.websites.push({ url, name: name || url });
    }
    
    // Do an immediate first check
    return this.checkWebsite(url, name);
  }

  /**
   * Check a single website's health
   * This is the core monitoring function
   */
  async checkWebsite(url, name) {
    const startTime = Date.now();
    
    const result = {
      url,
      name: name || url,
      is_up: false,
      status_code: null,
      response_time_ms: null,
      error_message: null,
      ssl_expiry: null,
      ssl_valid: null,
      headers: null,
      checked_at: new Date().toISOString(),
    };

    try {
      // Make the HTTP request with a 10-second timeout
      const response = await axios.get(url, {
        timeout: 10000,
        // Don't throw on non-2xx status codes (we want to record them)
        validateStatus: () => true,
        // Follow redirects (up to 5)
        maxRedirects: 5,
        // Don't download large bodies
        maxContentLength: 1024 * 100, // 100KB max
      });

      result.is_up = response.status >= 200 && response.status < 400;
      result.status_code = response.status;
      result.response_time_ms = Date.now() - startTime;
      result.headers = JSON.stringify(this.extractSecurityHeaders(response.headers));

      // Check SSL certificate if HTTPS
      if (url.startsWith('https://')) {
        const sslInfo = await this.checkSSL(url);
        result.ssl_expiry = sslInfo.expiry;
        result.ssl_valid = sslInfo.valid;
      }

    } catch (err) {
      result.is_up = false;
      result.response_time_ms = Date.now() - startTime;
      result.error_message = err.message;
      logger.warn(`Website check failed: ${url} — ${err.message}`);
    }

    // Store the result
    await db('website_checks').insert({ id: uuidv4(), ...result });

    logger.debug(`Website check: ${url} → ${result.is_up ? '✅ UP' : '❌ DOWN'} (${result.response_time_ms}ms)`);

    return result;
  }

  /**
   * Check SSL certificate validity and expiry
   * 
   * How this works:
   * We open a raw TLS connection to the server (port 443),
   * grab the certificate, and read its "valid to" date.
   */
  async checkSSL(url) {
    return new Promise((resolve) => {
      try {
        const { hostname } = new URL(url);
        
        const socket = tls.connect({
          host: hostname,
          port: 443,
          servername: hostname,
          timeout: 5000,
        }, () => {
          const cert = socket.getPeerCertificate();
          socket.destroy();

          if (cert && cert.valid_to) {
            const expiry = new Date(cert.valid_to);
            const now = new Date();
            resolve({
              valid: expiry > now,
              expiry: expiry.toISOString(),
              daysRemaining: Math.floor((expiry - now) / (1000 * 60 * 60 * 24)),
            });
          } else {
            resolve({ valid: false, expiry: null });
          }
        });

        socket.on('error', () => {
          resolve({ valid: false, expiry: null });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ valid: false, expiry: null });
        });

      } catch (err) {
        resolve({ valid: false, expiry: null });
      }
    });
  }

  /**
   * Extract security-relevant headers
   * These tell us if the website has basic security measures in place
   */
  extractSecurityHeaders(headers) {
    const securityHeaders = [
      'strict-transport-security',  // HSTS — forces HTTPS
      'content-security-policy',    // CSP — prevents XSS
      'x-content-type-options',     // Prevents MIME sniffing
      'x-frame-options',            // Prevents clickjacking
      'x-xss-protection',          // Legacy XSS filter
      'referrer-policy',
      'permissions-policy',
    ];

    const found = {};
    for (const header of securityHeaders) {
      if (headers[header]) {
        found[header] = headers[header];
      }
    }
    return found;
  }

  /**
   * Run checks on all monitored websites
   * Called by the cron scheduler
   */
  async checkAllWebsites() {
    await this.loadWebsites();

    if (this.websites.length === 0) {
      logger.debug('No websites configured for monitoring');
      return [];
    }

    logger.info(`Running website checks for ${this.websites.length} sites...`);

    const results = await Promise.all(
      this.websites.map(site => this.checkWebsite(site.url, site.name))
    );

    return results;
  }

  /**
   * Get latest check results for all websites
   */
  async getLatestChecks() {
    const urls = await db('website_checks')
      .distinct('url')
      .orderBy('url');

    const results = [];
    for (const { url } of urls) {
      const latest = await db('website_checks')
        .where({ url })
        .orderBy('checked_at', 'desc')
        .first();
      if (latest) results.push(latest);
    }

    return results;
  }

  /**
   * Get check history for a specific website
   */
  async getCheckHistory(url, { limit = 100, from, to } = {}) {
    let query = db('website_checks')
      .where({ url })
      .orderBy('checked_at', 'desc')
      .limit(limit);

    if (from) query = query.where('checked_at', '>=', from);
    if (to) query = query.where('checked_at', '<=', to);

    return query;
  }
}

module.exports = new WebsiteMonitorService();
