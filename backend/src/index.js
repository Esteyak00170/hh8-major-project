/**
 * ============================================
 *   AI Security Dashboard — Backend Server
 * ============================================
 *
 * Startup sequence:
 * 1. Test database connection
 * 2. Run migrations (schema up-to-date)
 * 3. Seed default admin user (first run only)
 * 4. Initialize job queue (Redis if available, sync fallback)
 * 5. Mount all API routes
 * 6. Start HTTP + Socket.IO server
 * 7. Start website monitor cron (every 2 min)
 * 8. Start offline agent detector cron (every 30 sec)
 * 9. Auto-start demo simulator in dev mode
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const { Server: SocketServer } = require('socket.io');

const config = require('./config');
const logger = require('./config/logger');
const db = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const healthRoutes = require('./api/health');
const authRoutes = require('./api/auth');
const metricsRoutes = require('./api/metrics');
const alertsRoutes = require('./api/alerts');
const serversRoutes = require('./api/servers');
const logsRoutes = require('./api/logs');
const websitesRoutes = require('./api/websites');

// Services & Jobs
const websiteMonitor = require('./services/websiteMonitorService');
const demoSimulator = require('./services/demoSimulator');
const authService = require('./services/authService');
const { initMetricsQueue, getQueueStats } = require('./jobs/metricsWorker');
const { detectOfflineAgents } = require('./jobs/offlineDetector');

// ── Express + HTTP Server ──────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

// ── Security Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));

// Global rate limit (stricter limits applied per-route for auth)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── API Routes ────────────────────────────────────────────────────
app.use(`${config.apiPrefix}`, healthRoutes);
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/metrics`, metricsRoutes);
app.use(`${config.apiPrefix}/alerts`, alertsRoutes);
app.use(`${config.apiPrefix}/servers`, serversRoutes);
app.use(`${config.apiPrefix}/logs`, logsRoutes);
app.use(`${config.apiPrefix}/websites`, websitesRoutes);

// Root
app.get('/', (req, res) => {
  res.json({ name: 'AI Security Dashboard API', version: '1.0.0', status: 'running' });
});

// Queue stats endpoint (for health monitoring)
app.get(`${config.apiPrefix}/queue/stats`, async (req, res) => {
  const stats = await getQueueStats();
  res.json({ queue: stats });
});

// Demo simulator control
app.post(`${config.apiPrefix}/demo/start`, (req, res) => {
  demoSimulator.start(req.body?.intervalMs || 10000);
  res.json({ message: 'Demo simulator started' });
});
app.post(`${config.apiPrefix}/demo/stop`, (req, res) => {
  demoSimulator.stop();
  res.json({ message: 'Demo simulator stopped' });
});

// ── Error Handling ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Socket.IO Connection Handling ────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Dashboard client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    logger.info(`Dashboard client disconnected: ${socket.id}`);
  });
});

// ── Startup Sequence ──────────────────────────────────────────────
async function startServer() {
  try {
    // 1. Database connection
    logger.info('Testing database connection...');
    await db.raw('SELECT 1');
    logger.info('✅ Database connected');

    // 2. Migrations
    logger.info('Running database migrations...');
    await db.migrate.latest({ directory: './src/models/migrations' });
    logger.info('✅ Migrations complete');

    // 3. Seed default admin user
    await authService.createDefaultAdmin();

    // 4. Initialize job queue (graceful fallback if Redis unavailable)
    await initMetricsQueue(config.redis);

    // 5. Start HTTP server
    server.listen(config.port, () => {
      logger.info(`🚀 AI Security Dashboard API running on port ${config.port}`);
      logger.info(`📡 Environment: ${config.env}`);
      logger.info(`🔗 Health:  http://localhost:${config.port}${config.apiPrefix}/health`);
      logger.info(`🔐 Login:   POST http://localhost:${config.port}${config.apiPrefix}/auth/login`);
    });

    // 6. Website monitor cron (every 2 minutes)
    cron.schedule('*/2 * * * *', async () => {
      try {
        const results = await websiteMonitor.checkAllWebsites();
        if (results.length > 0) io.emit('websites:updated', results);
      } catch (err) {
        logger.error(`Website monitor error: ${err.message}`);
      }
    });
    logger.info('⏰ Website monitor: every 2 minutes');

    // 7. Offline agent detector (every 30 seconds)
    cron.schedule('*/30 * * * * *', async () => {
      await detectOfflineAgents(io);
    });
    logger.info('🔍 Offline detector: every 30 seconds');

    // 8. Auto-start demo simulator in development
    if (config.env === 'development') {
      setTimeout(() => {
        logger.info('🎭 Starting demo simulator...');
        demoSimulator.start(10000);
      }, 2000);
    }

  } catch (err) {
    logger.error(`Startup failed: ${err.message}`);

    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
      logger.warn('⚠️  Database unavailable — starting in limited mode');
      server.listen(config.port, () => {
        logger.info(`🚀 API running on port ${config.port} (LIMITED MODE)`);
      });
    } else {
      process.exit(1);
    }
  }
}

startServer();

// ── Graceful Shutdown ─────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received. Shutting down...`);
  demoSimulator.stop();
  server.close(() => {
    db.destroy().then(() => {
      logger.info('Server closed cleanly.');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };
