/**
 * Offline Agent Detector
 *
 * ───────────────────────────────────────────────────────
 * HOW IT WORKS:
 * ───────────────────────────────────────────────────────
 *
 * Every agent sends a heartbeat (metrics payload) every 10 seconds.
 * If a server's `last_seen_at` is more than 2 minutes old,
 * something is wrong — the agent crashed, the server went down,
 * or the network broke.
 *
 * This detector runs every 30 seconds and checks every registered server.
 *
 * When it detects an offline server:
 * 1. Updates server status to 'offline'
 * 2. Creates an 'agent_offline' alert
 * 3. Broadcasts the status change via WebSocket (dashboard turns red)
 *
 * When it detects a previously-offline server come back:
 * 1. Updates server status to 'online'
 * 2. Resolves the open alert
 * 3. Broadcasts recovery via WebSocket
 *
 * This is the "dead man's switch" pattern — if the agent
 * stops checking in, we assume the worst and alert.
 */

const db = require('../config/database');
const alertsService = require('../services/alertsService');
const logger = require('../config/logger');

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

async function detectOfflineAgents(io) {
  try {
    const servers = await db('servers').where({ status: 'online' })
      .orWhere({ status: 'warning' })
      .orWhere({ status: 'offline' });

    const now = Date.now();

    for (const server of servers) {
      const lastSeen = new Date(server.last_seen_at).getTime();
      const msSinceLastSeen = now - lastSeen;
      const isOverdue = msSinceLastSeen > OFFLINE_THRESHOLD_MS;

      if (isOverdue && server.status !== 'offline') {
        // Agent went offline — mark it and alert
        const minutesAgo = Math.floor(msSinceLastSeen / 60000);

        await db('servers').where({ server_id: server.server_id }).update({
          status: 'offline',
          updated_at: new Date().toISOString(),
        });

        await alertsService.createAlert({
          severity: 'critical',
          type: 'agent_offline',
          title: `Agent Offline: ${server.name}`,
          message: `Server "${server.name}" (${server.server_id}) has not reported in ${minutesAgo} minute(s). Last seen: ${new Date(server.last_seen_at).toLocaleString()}`,
          source: 'offline-detector',
          serverId: server.server_id,
          context: { lastSeenAt: server.last_seen_at, minutesAgo },
        });

        logger.warn(`🔴 Agent OFFLINE: ${server.server_id} (silent for ${minutesAgo}m)`);

        // Broadcast to dashboard
        if (io) {
          io.emit('server:offline', {
            serverId: server.server_id,
            serverName: server.name,
            lastSeenAt: server.last_seen_at,
          });
        }

      } else if (!isOverdue && server.status === 'offline') {
        // Agent came back online — recover
        await db('servers').where({ server_id: server.server_id }).update({
          status: 'online',
          updated_at: new Date().toISOString(),
        });

        // Resolve open agent_offline alerts for this server
        await db('alerts')
          .where({ server_id: server.server_id, type: 'agent_offline', status: 'active' })
          .update({ status: 'resolved', resolved_at: new Date().toISOString() });

        logger.info(`🟢 Agent RECOVERED: ${server.server_id}`);

        if (io) {
          io.emit('server:online', {
            serverId: server.server_id,
            serverName: server.name,
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Offline detector error: ${err.message}`);
  }
}

module.exports = { detectOfflineAgents };
