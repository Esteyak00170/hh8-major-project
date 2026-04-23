import { useState, useEffect } from 'react';
import { Server, Shield, AlertTriangle, Globe, Activity, Zap } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { getServers, getAlerts } from '../services/api';
import { socketService } from '../services/socket';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function Overview() {
  const [stats, setStats] = useState({ servers: 0, alertsToday: 0, websites: 0 });
  const [alerts, setAlerts] = useState([]);
  const [metricData, setMetricData] = useState([]); // Array of chart data points
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial Data Load
    const fetchData = async () => {
      try {
        const [serversData, alertsData] = await Promise.all([
          getServers(),
          getAlerts()
        ]);
        
        setStats({
          servers: serversData.length,
          alertsToday: alertsData.length,
          websites: 0 // Mock for now until websiters API is wired
        });
        
        setAlerts(alertsData.slice(0, 5)); // Show only 5 most recent
        setLoading(false);
      } catch (err) {
        console.error("Failed to load initial data", err);
        setLoading(false);
      }
    };
    
    fetchData();

    // 2. Connect WebSocket
    socketService.connect();

    const handleNewAlert = (newAlert) => {
      setAlerts(prev => [newAlert, ...prev].slice(0, 5));
      setStats(prev => ({ ...prev, alertsToday: prev.alertsToday + 1 }));
    };

    const handleMetricUpdate = (metric) => {
      setMetricData(prev => {
        // Keep last 15 points
        const updated = [...prev, metric].slice(-15);
        return updated;
      });
    };

    socketService.onNewAlert(handleNewAlert);
    socketService.onMetricUpdate(handleMetricUpdate);

    return () => {
      socketService.offNewAlert(handleNewAlert);
      socketService.offMetricUpdate(handleMetricUpdate);
    };
  }, []);

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Chart configuration
  const chartData = {
    labels: metricData.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: metricData.map(m => m.cpuUsage),
        borderColor: '#6366f1', // Indigo
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Memory Usage (%)',
        data: metricData.map(m => m.memoryUsage),
        borderColor: '#06b6d4', // Cyan
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
      x: { grid: { display: false } }
    },
    plugins: {
      legend: { labels: { color: '#f1f5f9' } }
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Dashboard Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Real-time security monitoring across all systems
          </p>
        </div>
        <span style={{ color: 'var(--text-secondary)' }}>{now}</span>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: '100px', marginBottom: '24px' }}></div>
      ) : (
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          <StatCard title="Servers Online" value={stats.servers} icon={Server} color="indigo" />
          <StatCard title="Active Threats" value={alerts.filter(a => a.status === 'active').length} icon={Shield} color="red" />
          <StatCard title="Websites Monitored" value={stats.websites} icon={Globe} color="cyan" />
          <StatCard title="Alerts Today" value={stats.alertsToday} icon={AlertTriangle} color="amber" />
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="card glass">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} /> System Load (Live Stream)
          </h3>
          <div style={{ height: '300px' }}>
            {metricData.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Waiting for streaming metric data...
              </div>
            )}
          </div>
        </div>

        <div className="card glass" style={{ overflow: 'hidden' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} /> Recent Alerts
          </h3>
          {alerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent alerts found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map((alert) => (
                <div key={alert.id} style={{ display: 'flex', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: `4px solid var(--status-${alert.severity})` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{alert.title || alert.message}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(alert.created_at || Date.now()).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Server: {alert.server_id || 'Unknown'} | Source: {alert.source}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorMap = {
    indigo: '#6366f1',
    red: '#ef4444',
    cyan: '#06b6d4',
    amber: '#f59e0b'
  };
  const hexHex = colorMap[color] || colorMap.indigo;

  return (
    <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
      <div style={{ padding: '12px', borderRadius: '12px', background: `${hexHex}20`, color: hexHex }}>
        <Icon size={24} />
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default Overview;
