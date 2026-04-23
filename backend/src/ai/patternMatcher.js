/**
 * Log Pattern Analysis
 * 
 * Uses regex and known threat signatures to detect malicious activity
 * hidden within application and system logs.
 */

const THREAT_SIGNATURES = [
  {
    id: 'SIG_SQLI',
    name: 'SQL Injection Attempt',
    regex: /(?:'|")\s*(?:OR|AND)\s*(?:'|")?\d+(?:'|")?\s*=\s*(?:'|")?\d+/i,
    severity: 'critical',
    description: 'Detected potential SQL injection payload in log message.'
  },
  {
    id: 'SIG_XSS',
    name: 'Cross-Site Scripting (XSS)',
    regex: /<script\b[^>]*>(.*?)<\/script>/i,
    severity: 'high',
    description: 'Detected potentially malicious script tags.'
  },
  {
    id: 'SIG_BRUTE_FORCE',
    name: 'Authentication Brute Force',
    // This is simplistic; real brute force is better caught by aggregating counts over time
    regex: /failed login|authentication failure|incorrect password/i,
    severity: 'medium', // Upgraded to high if many occur in a short window
    description: 'Failed authentication attempt.'
  },
  {
    id: 'SIG_PATH_TRAVERSAL',
    name: 'Path Traversal Attempt',
    regex: /(?:\.\.\/|\.\.\\){2,}/,
    severity: 'high',
    description: 'Detected attempt to access restricted directories.'
  },
  {
    id: 'SIG_SUDO_FAIL',
    name: 'Failed Sudo Attempt',
    regex: /incorrect password attempt|NOT in sudoers/i,
    severity: 'high',
    description: 'Unauthorized user attempted to execute privileged commands.'
  }
];

/**
 * Scan a single log entry against known threat signatures.
 * 
 * @param {object} logEntry - The log object { message, source, metadata }
 * @returns {object[]} Array of matched threats
 */
function scanLogLine(logEntry) {
  const matches = [];

  for (const sig of THREAT_SIGNATURES) {
    if (sig.regex.test(logEntry.message)) {
      matches.push({
        signatureId: sig.id,
        name: sig.name,
        severity: sig.severity,
        description: sig.description,
        matchedMessage: logEntry.message
      });
    }
  }

  return matches;
}

/**
 * Scan a batch of logs.
 * 
 * @param {object[]} logs - Array of incoming log entries
 * @returns {object[]} Array of all threat matches found in the batch
 */
function analyzeLogs(logs) {
  const threats = [];

  for (const log of logs) {
    const matches = scanLogLine(log);
    if (matches.length > 0) {
      threats.push(...matches.map(m => ({
        ...m,
        logSource: log.source,
        timestamp: log.timestamp || new Date().toISOString()
      })));
    }
  }

  // Basic temporal aggregation: if we see > 5 brute force attempts in this batch, elevate to critical.
  const authFails = threats.filter(t => t.signatureId === 'SIG_BRUTE_FORCE');
  if (authFails.length >= 5) {
    threats.push({
      signatureId: 'SIG_BRUTE_FORCE_BURST',
      name: 'Active Brute Force Attack',
      severity: 'critical',
      description: `Detected ${authFails.length} failed login attempts in a single log batch.`,
      logSource: authFails[0].logSource,
      timestamp: new Date().toISOString()
    });
  }

  // Filter out the individual medium severity fails if we emitted a burst event to reduce noise?
  // We'll leave them for now so the UI can group them.

  return threats;
}

module.exports = {
  scanLogLine,
  analyzeLogs,
  THREAT_SIGNATURES
};
