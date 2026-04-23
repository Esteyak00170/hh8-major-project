/**
 * Error Handling Middleware
 * 
 * This is the "catch-all" safety net. If any route throws an error,
 * Express skips to this middleware (because it has 4 params: err, req, res, next).
 * 
 * Without this, unhandled errors crash the entire server.
 */

const logger = require('../config/logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
  // Log the full error internally
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send clean response to client
  res.status(statusCode).json({
    error: config.env === 'production'
      ? 'Internal server error'    // Never leak stack traces in production
      : err.message,               // Show details in development
    ...(config.env !== 'production' && { stack: err.stack }),
  });
}

/**
 * 404 handler — must be registered AFTER all routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  });
}

module.exports = { errorHandler, notFoundHandler };
