import { useState, useEffect } from 'react';
import { getAlerts, getAlertStats } from '../services/api';
import { AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, today: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [alertsData, statsData] = await Promise.all([
          getAlerts(),
          getAlertStats()
        ]);
        setAlerts(alertsData);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to fetch alerts', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2>Security Alerts Central</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Triaged threats from the AI analysis engine</p>
      </div>

      {/* Stats row */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <AlertTriangle color="var(--status-critical)" size={32} />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.active}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Alerts</div>
          </div>
        </div>
        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <Clock color="var(--status-warning)" size={32} />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.today}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Alerts Today</div>
          </div>
        </div>
        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <ShieldCheck color="var(--status-healthy)" size={32} />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total - stats.active}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Resolved</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: '400px' }}></div>
      ) : (
        <div className="card glass">
          <table className="alerts-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px' }}>Severity</th>
                <th style={{ padding: '12px' }}>Time</th>
                <th style={{ padding: '12px' }}>Server / Source</th>
                <th style={{ padding: '12px' }}>Title</th>
                <th style={{ padding: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No alerts found in history.</td></tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px' }}>
                       <span style={{ 
                         padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase',
                         color: `var(--status-${alert.severity})`, background: `color-mix(in srgb, var(--status-${alert.severity}) 20%, transparent)`
                       }}>{alert.severity}</span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(alert.created_at).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>{alert.server_id || alert.source}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '500', marginBottom: '4px' }}>{alert.title || 'Security Alert'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alert.message}</div>
                    </td>
                    <td style={{ padding: '12px', textTransform: 'capitalize', fontSize: '0.85rem', color: alert.status === 'active' ? 'var(--status-critical)' : 'var(--text-muted)' }}>{alert.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Alerts;
