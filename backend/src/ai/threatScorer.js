/**
 * Threat Scorer
 * 
 * Aggregates signals from the anomaly detector, pattern matcher,
 * and base rules to compute a final threat score and dispatch alerts.
 */

const alertsService = require('../services/alertsService');
const logger = require('../config/logger');

// The points map correlates to standard severity levels
const SEVERITY_MAP = {
  low: { minPoints: 1, maxPoints: 39 },
  medium: { minPoints: 40, maxPoints: 69 },
  high: { minPoints: 70, maxPoints: 89 },
  critical: { minPoints: 90, maxPoints: 100 }
};

/**
 * Normalizes severity strings to points
 */
function severityToPoints(severity) {
  switch (severity) {
    case 'critical': return 90;
    case 'high': return 75;
    case 'medium': return 50;
    case 'low': return 25;
    default: return 10;
  }
}

/**
 * Maps cumulative points back to a severity level
 */
function pointsToSeverity(points) {
  if (points >= SEVERITY_MAP.critical.minPoints) return 'critical';
  if (points >= SEVERITY_MAP.high.minPoints) return 'high';
  if (points >= SEVERITY_MAP.medium.minPoints) return 'medium';
  return 'low';
}

/**
 * Handle anomalies found in metrics.
 * Since metrics are continuous, we process anomalies directly and log them as alerts.
 * 
 * @param {string} serverId 
 * @param {object[]} anomalies 
 * @param {object} io (optional) Socket instance to broadcast
 */
async function processMetricsAnomalies(serverId, anomalies, io) {
  if (!anomalies || anomalies.length === 0) return [];

  const createdAlerts = [];

  for (const anomaly of anomalies) {
    // Generate an alert
    const points = typeof anomaly.severity === 'number' ? anomaly.severity : severityToPoints(anomaly.severity);
    const severityStr = pointsToSeverity(points);

    logger.warn(`[AI Engine] Metrics anomaly detected on ${serverId}: ${anomaly.description}`);

    const alertDetails = {
      severity: severityStr,
      type: 'anomaly',
      title: `Anomaly: ${anomaly.metric}`,
      message: anomaly.description,
      source: 'metrics_anomaly',
      serverId: serverId,
      context: { 
        metric: anomaly.metric, 
        value: anomaly.value, 
        zScore: anomaly.zScore,
        aiGenerated: true 
      }
    };

    const newAlert = await alertsService.createAlert(alertDetails);
    createdAlerts.push(newAlert);
    
    if (io) {
      io.emit('alert:new', newAlert);
    }
  }

  return createdAlerts;
}

/**
 * Handle threats found in logs.
 * We might batch them if there are many.
 * 
 * @param {string} serverId 
 * @param {object[]} threats 
 * @param {object} io 
 */
async function processLogThreats(serverId, threats, io) {
  if (!threats || threats.length === 0) return [];

  const createdAlerts = [];

  for (const threat of threats) {
    logger.warn(`[AI Engine] Log threat detected on ${serverId}: ${threat.name}`);

    const newAlert = await alertsService.createAlert({
      severity: threat.severity,
      type: 'security_threat',
      title: `Threat: ${threat.name}`,
      message: `Suspicious Log: ${threat.name}`,
      source: 'log_pattern',
      serverId: serverId,
      context: {
        signatureId: threat.signatureId,
        matchedMessage: threat.matchedMessage,
        logSource: threat.logSource,
        aiGenerated: true
      }
    });

    createdAlerts.push(newAlert);

    if (io) {
      io.emit('alert:new', newAlert);
    }
  }

  return createdAlerts;
}

module.exports = {
  processMetricsAnomalies,
  processLogThreats
};
