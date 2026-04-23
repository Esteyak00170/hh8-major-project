/**
 * Logger Configuration (Winston)
 * 
 * Why not just use console.log?
 * - console.log has no log levels (info vs error vs debug)
 * - console.log can't write to files
 * - console.log can't be turned off in production (noisy)
 * 
 * Winston gives us structured, leveled logging that's production-ready.
 */

const winston = require('winston');
const config = require('./index');

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',

  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  defaultMeta: { service: 'aisd-backend' },

  transports: [
    // Write errors to a separate file for easy debugging
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// In development, also log to the console with colors
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 1
          ? ` ${JSON.stringify(meta)}`
          : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    ),
  }));
}

module.exports = logger;
