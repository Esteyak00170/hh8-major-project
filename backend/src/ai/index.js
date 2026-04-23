// AI Threat Detection Engine
const anomalyDetector = require('./anomalyDetector');
const patternMatcher = require('./patternMatcher');
const threatScorer = require('./threatScorer');

module.exports = {
  anomalyDetector,
  patternMatcher,
  threatScorer
};
