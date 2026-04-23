import { useState, useEffect } from 'react';
import { getServers } from '../services/api';
import { Server, Activity, Thermometer, Database } from 'lucide-react';

function Servers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const data = await getServers();
        setServers(data);
      } catch (err) {
        console.error('Failed to fetch servers', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServers();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2>Monitored Servers</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View details and current metrics for all monitored infrastructure</p>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: '200px' }}></div>
      ) : (
        <div className="grid-3">
          {servers.map(server => (
            <div key={server.server_id} className="card glass">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={20} color="var(--accent-primary)" />
                  <div>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{server.name}</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{server.server_id}</div>
                  </div>
                </div>
                <span className={`status-dot ${server.status === 'active' ? 'healthy' : 'critical'}`} title={server.status}></span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <ProgressBar icon={Activity} label="CPU" value={server.cpuUsage || 0} maxValue={100} color="#6366f1" />
                <ProgressBar icon={Database} label="RAM" value={server.memoryUsage || 0} maxValue={100} color="#06b6d4" />
                <ProgressBar icon={Thermometer} label="Disk" value={server.diskUsage || 0} maxValue={100} color="#10b981" />
              </div>

              {server.activeAlertCount > 0 && (
                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--status-critical)', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
                  {server.activeAlertCount} active alert{server.activeAlertCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ icon: Icon, label, value, maxValue, color }) {
  const percent = Math.min(100, Math.max(0, (value / maxValue) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Icon size={12} /> {label}</span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: color, transition: 'width 0.3s ease' }}></div>
      </div>
    </div>
  );
}

export default Servers;
