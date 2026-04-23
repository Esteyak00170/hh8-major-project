import axios from 'axios';

// Get base URL from env or default to localhost:3001
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Create configured axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auth interceptor
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Auth API Calls ---
export const login = (email, password) => api.post('/auth/login', { email, password }).then(res => res.data);
export const logout = () => api.post('/auth/logout').then(res => res.data);

// --- Server API Calls ---
export const getServers = () => api.get('/servers').then(res => res.data.servers);
export const getServerDetails = (id) => api.get(`/servers/${id}`).then(res => res.data);
export const getServerMetrics = (id, limit = 100) => api.get(`/servers/${id}/metrics?limit=${limit}`).then(res => res.data);

// --- Alerts API Calls ---
export const getAlerts = () => api.get('/alerts').then(res => res.data.alerts);
export const getAlertStats = () => api.get('/alerts/stats').then(res => res.data.stats);

// --- Logs API Calls ---
export const getLogs = ({ serverId, severity, source, limit = 100, offset = 0 } = {}) => {
  const params = new URLSearchParams();
  if (serverId) params.append('serverId', serverId);
  if (severity) params.append('severity', severity);
  if (source) params.append('source', source);
  params.append('limit', limit);
  params.append('offset', offset);
  return api.get(`/logs?${params.toString()}`).then(res => res.data.logs);
};

export const getLogStats = () => api.get('/logs/stats').then(res => res.data.stats);

// --- Website API Calls ---
export const getWebsites = () => api.get('/websites').then(res => res.data.websites);
export const addWebsite = (url, name) => api.post('/websites', { url, name }).then(res => res.data);
export const checkWebsitesNow = () => api.post('/websites/check-now').then(res => res.data.results);

// --- General Dashboard Stats ---
export const getOverviewStats = async () => {
  const [servers, alertsData] = await Promise.all([
    getServers(),
    api.get('/alerts').then(res => res.data.alerts)
  ]);
  
  return {
    serverCount: servers.length,
    activeAlerts: alertsData.filter(a => a.status === 'active').length,
    alertsToday: alertsData.length
  };
};
