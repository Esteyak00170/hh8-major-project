/**
 * Metrics Queue Worker (BullMQ)
 *
 * ───────────────────────────────────────────────────────
 * WHY A JOB QUEUE?
 * ───────────────────────────────────────────────────────
 *
 * Imagine 50 servers all sending metrics at the same second.
 * Without a queue:
 *   50 requests × (DB write + AI check + WebSocket emit) = system chokes
 *
 * With a queue:
 *   50 requests → API accepts instantly (202) → drops jobs in queue
 *   Worker processes at its own pace, retries on failure
 *
 * The API becomes lightning-fast. The worker absorbs the load.
 * This is called "decoupling" — separating intake from processing.
 *
 * ───────────────────────────────────────────────────────
 * GRACEFUL DEGRADATION:
 * ───────────────────────────────────────────────────────
 * If Redis is not available, the queue falls back to synchronous processing.
 * The system still works — just without the buffering benefit.
 * This makes development easy (no Redis needed) and production resilient.
 */

const metricsService = require('../services/metricsService');
const logger = require('../config/logger');

let queue = null;
let worker = null;
let isQueueAvailable = false;

/**
 * Initialize the BullMQ queue and worker
 * Called on server startup — silently falls back if Redis unavailable
 */
async function initMetricsQueue(redisConfig) {
  try {
    const { Queue, Worker } = require('bullmq');

    const connection = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      lazyConnect: true,
    };

    // Test connection before creating queue
    const IORedis = require('ioredis');
    const testConn = new IORedis({ ...connection, connectTimeout: 3000 });

    await new Promise((resolve, reject) => {
      testConn.on('connect', resolve);
      testConn.on('error', reject);
      setTimeout(reject, 3000); // 3s timeout
    });

    await testConn.quit();

    // Redis is available — set up queue
    queue = new Queue('metrics', {
      connection,
      defaultJobOptions: {
        attempts: 3,               // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',     // Wait 1s, 2s, 4s between retries
          delay: 1000,
        },
        removeOnComplete: 100,     // Keep last 100 completed jobs
        removeOnFail: 500,         // Keep last 500 failed jobs for debugging
      },
    });

    // Worker: processes one job at a time from the queue
    worker = new Worker('metrics', async (job) => {
      const { payload, io } = job.data;
      await processMetricPayload(payload, io);
    }, {
      connection,
      concurrency: 5,   // Process up to 5 jobs simultaneously
    });

    worker.on('completed', (job) => {
      logger.debug(`Queue job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Queue job ${job.id} failed: ${err.message}`);
    });

    isQueueAvailable = true;
    logger.info('✅ BullMQ metrics queue initialized (Redis connected)');

  } catch (err) {
    logger.warn(`⚠️  Redis unavailable — metrics queue disabled. Running synchronously.`);
    logger.warn(`   (This is fine for development. For production, start Redis.)`);
    isQueueAvailable = false;
  }
}

/**
 * Enqueue a metric for processing, or process synchronously as fallback
 *
 * @param {object} payload - Validated metric payload from the API
 * @param {object} io - Socket.IO server instance for broadcasting
 */
async function enqueueMetric(payload, io) {
  if (isQueueAvailable && queue) {
    // Queue mode: fast response, async processing
    await queue.add('process-metric', { payload });
    logger.debug(`Metric enqueued for ${payload.serverId}`);
  } else {
    // Synchronous fallback: process immediately
    await processMetricPayload(payload, io);
  }
}

async function processMetricPayload(payload, io) {
  // 1. Store in database
  const result = await metricsService.ingestMetrics(payload);

  // 2. AI Threat Analysis
  try {
    const aiEngine = require('../ai');
    // Fetch last 100 historical data points for this server to establish baseline
    const db = require('../config/database');
    const history = await db('metrics')
      .where({ server_id: payload.serverId })
      .orderBy('recorded_at', 'desc')
      .limit(100);
    
    if (history.length >= 5) {
      const historicalData = {
        cpu: history.map(h => h.cpu_usage),
        memory: history.map(h => h.memory_usage)
      };

      const anomalies = aiEngine.anomalyDetector.analyzeMetrics(
        { cpu: result.cpu_usage, memory: result.memory_usage },
        historicalData
      );

      if (anomalies.length > 0) {
        await aiEngine.threatScorer.processMetricsAnomalies(payload.serverId, anomalies, io);
      }
    }
  } catch (err) {
    logger.error(`AI Analysis failed for metrics on ${payload.serverId}: ${err.message}`);
  }

  // 3. Broadcast via WebSocket (if io available)
  if (io) {
    io.emit('metric:update', {
      serverId: payload.serverId,
      serverName: payload.serverName,
      cpuUsage: result.cpu_usage,
      memoryUsage: result.memory_usage,
      diskUsage: result.disk_usage,
      timestamp: payload.timestamp,
    });
  }

  return result;
}

/**
 * Get queue stats (for health endpoint and dashboard)
 */
async function getQueueStats() {
  if (!isQueueAvailable || !queue) {
    return { available: false, mode: 'synchronous' };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return {
    available: true,
    mode: 'queued',
    waiting,
    active,
    completed,
    failed,
  };
}

module.exports = { initMetricsQueue, enqueueMetric, getQueueStats, isQueueAvailable: () => isQueueAvailable };
