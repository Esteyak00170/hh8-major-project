/**
 * Simple Agent Logger
 * 
 * The agent is meant to be lightweight, so we use a simple console logger
 * with timestamps instead of a heavy library like Winston.
 */

const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] [INFO]  ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toISOString()}] [WARN]  ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`),
  debug: (msg) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${new Date().toISOString()}] [DEBUG] ${msg}`);
    }
  },
};

module.exports = logger;
