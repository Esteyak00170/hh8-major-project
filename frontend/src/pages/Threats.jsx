/**
 * AI Threats Page — Real-time threat intelligence and analysis
 * 
 * Features:
 * - Threat score gauge visualization
 * - Live log pattern match feed
 * - Anomaly detection timeline
 * - Threat signature library reference
 * - Severity breakdown donut chart
 */

import { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Search, Zap, Brain, Bug, AlertOctagon, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { getAlerts, getLogs } from '../services/api';
import { socketService } from '../services/socket';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// Known threat signatures (mirrors backend patternMatcher.js for reference display)
const THREAT_SIGNATURES = [
  { id: 'SIG_SQLI', name: 'SQL Injection', severity: 'critical', icon: Bug, description: 'Detects SQL injection payloads in log messages' },
  { id: 'SIG_XSS', name: 'Cross-Site Scripting', severity: 'high', icon: Bug, description: 'Detects malicious script tags embedded in requests' },
  { id: 'SIG_BRUTE_FORCE', name: 'Auth Brute Force', severity: 'medium', icon: ShieldAlert, description: 'Detects repeated failed authentication attempts' },
  { id: 'SIG_PATH_TRAVERSAL', name: 'Path Traversal', severity: 'high', icon: Search, description: 'Detects directory traversal attacks (../../)' },
  { id: 'SIG_SUDO_FAIL', name: 'Failed Sudo', severity: 'high', icon: AlertOctagon, description: 'Unauthorized privilege escalation attempts' },
];

function Threats() {
  const [aiAlerts, setAiAlerts] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'signatures'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [alertsData, logsData] = await Promise.all([
          getAlerts(),
          getLogs({ severity: 'critical', limit: 30 }),
        ]);

        // Filter AI-generated alerts (those with source containing 'anomaly' or 'pattern')
        const aiOnly = alertsData.filter(a =>
          a.source === 'metrics_anomaly' || a.source === 'log_pattern' || a.type === 'anomaly' || a.type === 'security_threat'
        );
        setAiAlerts(aiOnly);
        setRecentLogs(logsData);
      } catch (err) {
        console.error('Failed to load threat data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen for real-time AI alerts
    socketService.connect();

    const handleNewAlert = (alert) => {
      if (alert.source === 'metrics_anomaly' || alert.source === 'log_pattern') {
        setAiAlerts(prev => [alert, ...prev].slice(0, 100));
      }
    };

    const handleCriticalLog = ({ serverId, logs }) => {
      const formatted = logs.map(l => ({ ...l, server_id: serverId }));
      setRecentLogs(prev => [...formatted, ...prev].slice(0, 50));
    };

    socketService.onNewAlert(handleNewAlert);
    socketService.onCriticalLog(handleCriticalLog);

    return () => {
      socketService.offNewAlert(handleNewAlert);
      socketService.offCriticalLog(handleCriticalLog);
    };
  }, []);

  // Severity breakdown for donut chart
  const severityCounts = {
    critical: aiAlerts.filter(a => a.severity === 'critical').length,
    high: aiAlerts.filter(a => a.severity === 'high').length,
    medium: aiAlerts.filter(a => a.severity === 'medium').length,
    low: aiAlerts.filter(a => a.severity === 'low').length,
  };

  const donutData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [severityCounts.critical, severityCounts.high, severityCounts.medium, severityCounts.low],
      backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#6366f1'],
      borderColor: ['#dc262680', '#ea580c80', '#d9770080', '#4f46e580'],
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
    },
  };

  const totalThreats = aiAlerts.length;
  const activeThreats = aiAlerts.filter(a => a.status === 'active').length;
  const threatScore = totalThreats === 0 ? 0 : Math.min(100, Math.round((severityCounts.critical * 25 + severityCounts.high * 15 + severityCounts.medium * 5 + severityCounts.low * 1)));

  const getScoreColor = (score) => {
    if (score >= 70) return 'var(--status-critical)';
    if (score >= 40) return 'var(--status-warning)';
    if (score >= 10) return '#f97316';
    return 'var(--status-healthy)';
  };

  const getScoreLabel = (score) => {
    if (score >= 70) return 'Critical Risk';
    if (score >= 40) return 'Elevated Risk';
    if (score >= 10) return 'Moderate';
    return 'Low Risk';
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain size={24} style={{ color: 'var(--accent-primary)' }} /> AI Threat Analysis
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Machine-learning powered anomaly detection and log pattern analysis
          </p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        {/* Threat Score Gauge */}
        <div className="card glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
          <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '12px' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-secondary)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={getScoreColor(threatScore)} strokeWidth="8"
                strokeDasharray={`${(threatScore / 100) * 264} 264`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: getScoreColor(threatScore) }}>{threatScore}</span>
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: getScoreColor(threatScore) }}>{getScoreLabel(threatScore)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Threat Score</div>
        </div>

        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-critical)' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Active Threats</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{activeThreats}</div>
          </div>
        </div>

        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Total Detections</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{totalThreats}</div>
          </div>
        </div>

        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
            <Zap size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Signatures Active</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{THREAT_SIGNATURES.length}</div>
          </div>
        </div>
      </div>

      {/* Main Content: Chart + Feed */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Severity Breakdown */}
        <div className="card glass">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <Eye size={18} /> Severity Breakdown
          </h3>
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {totalThreats > 0 ? (
              <Doughnut data={donutData} options={donutOptions} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <ShieldAlert size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p>No threats detected yet</p>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>The AI engine is monitoring in real-time</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Critical Logs */}
        <div className="card glass" style={{ overflow: 'hidden' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <AlertOctagon size={18} /> Critical Log Feed
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {recentLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No critical logs captured yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentLogs.slice(0, 15).map((log, idx) => (
                  <div key={idx} style={{
                    padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '0.82rem',
                    borderLeft: `3px solid ${log.severity === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: log.severity === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                        {log.severity}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {log.server_id || 'unknown'} · {log.logged_at ? new Date(log.logged_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>{log.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Live Feed / Signatures */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        <button
          className={`btn ${activeTab === 'live' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('live')}
          id="tab-live-feed"
        >
          <Activity size={16} /> Live Threat Feed
        </button>
        <button
          className={`btn ${activeTab === 'signatures' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('signatures')}
          id="tab-signatures"
        >
          <Search size={16} /> Signature Library
        </button>
      </div>

      {activeTab === 'live' && (
        <div className="card glass">
          {loading ? (
            <div className="skeleton" style={{ height: '200px' }}></div>
          ) : aiAlerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Brain size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>AI engine is running. No threats detected in this session.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {aiAlerts.slice(0, 30).map((alert, idx) => (
                <div key={alert.id || idx}
                  className="threat-row"
                  style={{
                    padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: '8px', cursor: 'pointer',
                    borderLeft: `4px solid ${alert.severity === 'critical' ? 'var(--status-critical)' : alert.severity === 'high' ? '#f97316' : 'var(--status-warning)'}`,
                    transition: 'background 0.15s ease',
                  }}
                  onClick={() => setExpandedAlert(expandedAlert === idx ? null : idx)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                        background: `color-mix(in srgb, ${alert.severity === 'critical' ? 'var(--status-critical)' : alert.severity === 'high' ? '#f97316' : 'var(--status-warning)'} 20%, transparent)`,
                        color: alert.severity === 'critical' ? 'var(--status-critical)' : alert.severity === 'high' ? '#f97316' : 'var(--status-warning)',
                      }}>
                        {alert.severity}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{alert.title || 'AI Detection'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {alert.source === 'metrics_anomaly' ? '📊 Metrics Anomaly' : '📋 Log Pattern'} · Server: {alert.server_id || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {alert.created_at ? new Date(alert.created_at).toLocaleString() : ''}
                      </span>
                      {expandedAlert === idx ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {expandedAlert === idx && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Message:</strong>{' '}
                        <span style={{ color: 'var(--text-primary)' }}>{alert.message}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: 'var(--text-secondary)' }}>
                        <div><strong>Type:</strong> {alert.type}</div>
                        <div><strong>Source:</strong> {alert.source}</div>
                        <div><strong>Status:</strong> <span style={{ color: alert.status === 'active' ? 'var(--status-critical)' : 'var(--text-muted)', textTransform: 'capitalize' }}>{alert.status}</span></div>
                        <div><strong>AI Generated:</strong> ✅ Yes</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'signatures' && (
        <div className="card glass">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {THREAT_SIGNATURES.map(sig => {
              const SigIcon = sig.icon;
              return (
                <div key={sig.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                  <div style={{
                    padding: '10px', borderRadius: '10px',
                    background: sig.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : sig.severity === 'high' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: sig.severity === 'critical' ? 'var(--status-critical)' : sig.severity === 'high' ? '#f97316' : 'var(--status-warning)',
                  }}>
                    <SigIcon size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{sig.name}</strong>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                        background: sig.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' : sig.severity === 'high' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: sig.severity === 'critical' ? 'var(--status-critical)' : sig.severity === 'high' ? '#f97316' : 'var(--status-warning)',
                      }}>{sig.severity}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{sig.description}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px' }}>
                    {sig.id}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Threats;
