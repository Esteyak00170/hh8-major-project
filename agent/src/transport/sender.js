/**
 * Metrics Sender (Transport Layer)
 * 
 * Sends collected metrics to the backend API.
 * 
 * Key design decisions:
 * - Timeout: 5 seconds (if backend is slow, don't block the agent)
 * - No retries here (the next collection cycle will send fresh data anyway)
 * - API key sent in X-API-Key header (not in the URL or body)
 */

const axios = require('axios');

async function sendMetrics(apiUrl, apiKey, payload) {
  const response = await axios.post(`${apiUrl}/metrics`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    timeout: 5000,  // 5 second timeout
  });

  return response.data;
}

module.exports = { sendMetrics };
