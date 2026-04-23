/**
 * Statistical Anomaly Detection
 * 
 * Uses mathematical models to detect anomalous spikes in metric data.
 * No heavy machine learning frameworks needed — Z-score is extremely
 * effective for time-series infrastructure metrics.
 */

/**
 * Calculate the Z-score of a value against a historical numerical dataset.
 * Z-score = (Value - Mean) / Standard Deviation
 * 
 * Typically, a Z-score > 3 (or < -3) is considered an anomaly (3 standard deviations
 * away from the mean, accounting for ~99.7% of expected data).
 * 
 * @param {number} currentValue 
 * @param {number[]} historicalValues 
 * @returns {object} { isAnomaly, zScore, threshold }
 */
function checkZScoreAnomaly(currentValue, historicalValues, threshold = 3) {
  if (!historicalValues || historicalValues.length < 5) {
    // Not enough data to establish a baseline
    return { isAnomaly: false, zScore: 0, threshold };
  }

  // Calculate Mean
  const sum = historicalValues.reduce((a, b) => a + b, 0);
  const mean = sum / historicalValues.length;

  // Calculate Standard Deviation
  const squaredDiffs = historicalValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / historicalValues.length;
  const stdDev = Math.sqrt(variance);

  // If stdDev is 0 (all historical values are exactly the same), 
  // any deviation is technically an infinite Z-score.
  // We add a tiny epsilon to prevent division by zero.
  const zScore = (currentValue - mean) / (stdDev === 0 ? 0.0001 : stdDev);

  return {
    isAnomaly: Math.abs(zScore) >= threshold,
    zScore,
    threshold,
    mean,
    stdDev
  };
}

/**
 * Evaluates incoming server metrics against historical baselines.
 * 
 * @param {object} currentMetrics - { cpu, memory, disk, networkIn, networkOut }
 * @param {object} history - { cpu: [...], memory: [...], ... }
 * @returns {object} Details of any anomalies found
 */
function analyzeMetrics(currentMetrics, history) {
  const anomalies = [];

  // Define metric-specific thresholds. CPU is volatile, so maybe threshold=3.5 
  // Memory is stable, so threshold=2.5
  const config = {
    cpu: { threshold: 3 },
    memory: { threshold: 3 },
  };

  for (const [metricName, currentValue] of Object.entries(currentMetrics)) {
    if (history[metricName] && config[metricName]) {
      const result = checkZScoreAnomaly(
        currentValue, 
        history[metricName], 
        config[metricName].threshold
      );

      if (result.isAnomaly) {
        anomalies.push({
          metric: metricName,
          value: currentValue,
          zScore: parseFloat(result.zScore.toFixed(2)),
          description: `Unusual ${metricName.toUpperCase()} usage: ${currentValue}% (${result.zScore.toFixed(1)}σ above normal)`,
          severity: result.zScore >= 4 ? 'critical' : 'high'
        });
      }
    }
  }

  return anomalies;
}

module.exports = {
  checkZScoreAnomaly,
  analyzeMetrics
};
