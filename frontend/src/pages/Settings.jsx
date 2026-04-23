/**
 * Settings Page — Dashboard configuration and system info
 * 
 * Features:
 * - System health status overview
 * - Demo simulator controls (start/stop)
 * - Agent API key display
 * - Dashboard configuration reference
 * - Database and queue status
 */

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Play, Square, Key, Database, Server, Wifi, Shield, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { api } from '../services/api';

function Settings() {
  const [health, setHealth] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const [healthRes, queueRes] = await Promise.all([
        api.get('/health').catch(() => ({ data: { status: 'error' } })),
        api.get('/queue/stats').catch(() => ({ data: { queue: { available: false } } })),
      ]);
      setHealth(healthRes.data);
      setQueueStats(queueRes.data.queue);
    } catch (err) {
      console.error('Fetch system status failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoStart = async () => {
    setActionLoading(true);
    try {
      await api.post('/demo/start', { intervalMs: 10000 });
      setDemoRunning(true);
    } catch (err) {
      console.error('Failed to start demo', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemoStop = async () => {
    setActionLoading(true);
    try {
      await api.post('/demo/stop');
      setDemoRunning(false);
    } catch (err) {
      console.error('Failed to stop demo', err);
    } finally {
      setActionLoading(false);
    }
  };

  const StatusBadge = ({ ok, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {ok ? <CheckCircle2 size={16} color="var(--status-healthy)" /> : <XCircle size={16} color="var(--status-critical)" />}
      <span style={{ fontSize: '0.85rem', color: ok ? 'var(--status-healthy)' : 'var(--status-critical)' }}>{label}</span>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SettingsIcon size={24} style={{ color: 'var(--accent-primary)' }} /> Settings & System Info
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            System health, demo controls, and configuration
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchSystemStatus} id="btn-refresh-status">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* System Health */}
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-healthy)' }}>
              <Server size={20} />
            </div>
            <h3 style={{ fontSize: '1rem' }}>System Health</h3>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: '120px' }}></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Server size={16} /> API Server
                </div>
                <StatusBadge ok={health?.status === 'ok' || health?.status === 'healthy'} label={health?.status === 'ok' || health?.status === 'healthy' ? 'Online' : 'Offline'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Database size={16} /> Database
                </div>
                <StatusBadge ok={health?.database !== 'down'} label={health?.database === 'down' ? 'Disconnected' : 'Connected'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Wifi size={16} /> Redis / Queue
                </div>
                <StatusBadge ok={queueStats?.available} label={queueStats?.available ? `Online (${queueStats.mode})` : 'Offline (sync mode)'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Shield size={16} /> AI Engine
                </div>
                <StatusBadge ok={true} label="Active (5 Signatures)" />
              </div>
            </div>
          )}
        </div>

        {/* Demo Simulator */}
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
              <Play size={20} />
            </div>
            <h3 style={{ fontSize: '1rem' }}>Demo Simulator</h3>
          </div>

          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Info size={14} color="var(--accent-secondary)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>About the Simulator</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The demo simulator generates realistic server metrics, log entries, and security events
              to test the dashboard without real infrastructure. It simulates 5 servers with patterns
              like CPU spikes, memory leaks, and brute-force attacks.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${demoRunning ? 'healthy' : 'critical'}`}></span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {demoRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={handleDemoStart}
              disabled={demoRunning || actionLoading}
              style={{ flex: 1, justifyContent: 'center' }}
              id="btn-start-demo"
            >
              <Play size={16} /> Start Simulator
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleDemoStop}
              disabled={!demoRunning || actionLoading}
              style={{ flex: 1, justifyContent: 'center' }}
              id="btn-stop-demo"
            >
              <Square size={16} /> Stop
            </button>
          </div>

          {/* Quick stats if queue is available */}
          {queueStats?.available && (
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{queueStats.waiting || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Queued</div>
              </div>
              <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{queueStats.completed || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Processed</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Reference */}
      <div className="card glass" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
          <Key size={18} /> Configuration Reference
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="alerts-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px' }}>Setting</th>
                <th style={{ padding: '12px' }}>Env Variable</th>
                <th style={{ padding: '12px' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { setting: 'API Port', envVar: 'PORT', desc: 'Backend API server port (default: 3001)' },
                { setting: 'Database Host', envVar: 'DB_HOST', desc: 'PostgreSQL hostname' },
                { setting: 'Redis Host', envVar: 'REDIS_HOST', desc: 'Redis queue server hostname' },
                { setting: 'JWT Secret', envVar: 'JWT_SECRET', desc: 'Authentication token signing secret' },
                { setting: 'Agent API Key', envVar: 'AGENT_API_KEY', desc: 'API key for agent authentication' },
                { setting: 'SMTP Host', envVar: 'SMTP_HOST', desc: 'Email notifications server' },
                { setting: 'Webhook URL', envVar: 'WEBHOOK_URL', desc: 'Slack/Discord webhook for alerts' },
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{row.setting}</td>
                  <td style={{ padding: '12px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', color: 'var(--accent-secondary)' }}>
                      {row.envVar}
                    </code>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture Info */}
      <div className="card glass">
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
          <Info size={18} /> Architecture Overview
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🖥️</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Backend API</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Express.js + PostgreSQL</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>REST API + Socket.IO</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧠</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>AI Engine</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Z-Score Anomaly Detection</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pattern Matching + Scoring</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Dashboard</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>React + Vite + Chart.js</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Real-time WebSocket</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
