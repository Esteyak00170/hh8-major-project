/**
 * Websites Page — Monitor website uptime, response times, and SSL status
 * 
 * Features:
 * - Live status cards for each monitored website
 * - Response time bar visualization
 * - SSL certificate expiry tracking
 * - Add new websites to monitor
 * - Manual "Check Now" trigger
 */

import { useState, useEffect } from 'react';
import { Globe, Plus, RefreshCw, ShieldCheck, ShieldAlert, Clock, ArrowUpRight, X, Loader } from 'lucide-react';
import { getWebsites, addWebsite, checkWebsitesNow } from '../services/api';
import { socketService } from '../services/socket';

function Websites() {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    fetchWebsites();

    socketService.connect();

    const handleWebsiteUpdate = (results) => {
      if (Array.isArray(results)) {
        setWebsites(results);
      }
    };

    socketService.onWebsiteUpdate(handleWebsiteUpdate);

    return () => {
      socketService.offWebsiteUpdate(handleWebsiteUpdate);
    };
  }, []);

  const fetchWebsites = async () => {
    try {
      const data = await getWebsites();
      setWebsites(data);
    } catch (err) {
      console.error('Failed to fetch websites', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const results = await checkWebsitesNow();
      if (results) setWebsites(results);
    } catch (err) {
      console.error('Check failed', err);
    } finally {
      setChecking(false);
    }
  };

  const handleAddWebsite = async (e) => {
    e.preventDefault();
    setAddError('');
    
    if (!newUrl.trim()) {
      setAddError('URL is required');
      return;
    }

    try {
      await addWebsite(newUrl, newName);
      setNewUrl('');
      setNewName('');
      setShowAddModal(false);
      await fetchWebsites();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add website');
    }
  };

  const getStatusColor = (site) => {
    if (!site.is_up) return 'var(--status-critical)';
    if (site.response_time_ms > 2000) return 'var(--status-warning)';
    return 'var(--status-healthy)';
  };

  const getStatusLabel = (site) => {
    if (!site.is_up) return 'Down';
    if (site.response_time_ms > 2000) return 'Slow';
    return 'Healthy';
  };

  const getSSLStatus = (site) => {
    if (!site.ssl_valid && site.ssl_valid !== null) return { label: 'Invalid', color: 'var(--status-critical)', icon: ShieldAlert };
    if (site.ssl_valid) {
      const daysLeft = site.ssl_expiry ? Math.floor((new Date(site.ssl_expiry) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      if (daysLeft !== null && daysLeft < 30) return { label: `${daysLeft}d`, color: 'var(--status-warning)', icon: ShieldAlert };
      return { label: 'Valid', color: 'var(--status-healthy)', icon: ShieldCheck };
    }
    return { label: 'N/A', color: 'var(--text-muted)', icon: ShieldCheck };
  };

  const upCount = websites.filter(w => w.is_up).length;
  const downCount = websites.filter(w => !w.is_up).length;
  const avgResponseTime = websites.length > 0
    ? Math.round(websites.reduce((sum, w) => sum + (w.response_time_ms || 0), 0) / websites.length)
    : 0;

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Website Monitoring</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Uptime, response times, and SSL certificate status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={handleCheckNow} disabled={checking} id="btn-check-now">
            {checking ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
            Check Now
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} id="btn-add-website">
            <Plus size={16} /> Add Website
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-healthy)' }}>
            <Globe size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Sites Up</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{upCount}</div>
          </div>
        </div>
        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-critical)' }}>
            <Globe size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Sites Down</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{downCount}</div>
          </div>
        </div>
        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-secondary)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Avg Response</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{avgResponseTime}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span></div>
          </div>
        </div>
        <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>SSL Valid</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{websites.filter(w => w.ssl_valid).length}</div>
          </div>
        </div>
      </div>

      {/* Website Cards */}
      {loading ? (
        <div className="skeleton" style={{ height: '300px' }}></div>
      ) : websites.length === 0 ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Globe size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>No Websites Monitored</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Add websites to start tracking their uptime and performance.</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Your First Website
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {websites.map((site, idx) => {
            const ssl = getSSLStatus(site);
            const SSLIcon = ssl.icon;
            const maxResponseTime = Math.max(...websites.map(w => w.response_time_ms || 0), 1);
            const barWidth = ((site.response_time_ms || 0) / maxResponseTime) * 100;
            
            return (
              <div key={site.url || idx} className="card glass website-card" style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Status stripe */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: getStatusColor(site) }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className={`status-dot ${site.is_up ? 'healthy' : 'critical'}`}></span>
                      <h3 style={{ fontSize: '1rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {site.name || site.url}
                      </h3>
                    </div>
                    <a href={site.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                      {site.url} <ArrowUpRight size={12} />
                    </a>
                  </div>
                  <span style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                    background: `color-mix(in srgb, ${getStatusColor(site)} 20%, transparent)`,
                    color: getStatusColor(site),
                  }}>
                    {getStatusLabel(site)}
                  </span>
                </div>

                {/* Metrics row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Status</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: site.status_code && site.status_code < 400 ? 'var(--status-healthy)' : 'var(--status-critical)' }}>
                      {site.status_code || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Response</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                      {site.response_time_ms ? `${site.response_time_ms}ms` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>SSL</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '1.1rem', fontWeight: 600, color: ssl.color }}>
                      <SSLIcon size={14} /> {ssl.label}
                    </div>
                  </div>
                </div>

                {/* Response time bar */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Response Time</div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${barWidth}%`, borderRadius: '3px',
                      background: site.response_time_ms > 2000 ? 'var(--status-warning)' : site.response_time_ms > 5000 ? 'var(--status-critical)' : 'var(--status-healthy)',
                      transition: 'width 0.3s ease',
                    }}></div>
                  </div>
                </div>

                {/* Last checked */}
                <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Last checked: {site.checked_at ? new Date(site.checked_at).toLocaleString() : 'Never'}
                </div>

                {site.error_message && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--status-critical)', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                    {site.error_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Website Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content card glass animate-fade-in" onClick={e => e.stopPropagation()} id="add-website-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3>Add Website to Monitor</h3>
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)} style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddWebsite}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>URL *</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="form-input"
                  required
                  id="input-website-url"
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Display Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My Website"
                  className="form-input"
                  id="input-website-name"
                />
              </div>
              {addError && (
                <div style={{ marginBottom: '16px', color: 'var(--status-critical)', fontSize: '0.85rem' }}>{addError}</div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} id="btn-submit-website">
                <Plus size={16} /> Start Monitoring
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Websites;
