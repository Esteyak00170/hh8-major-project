/**
 * App Component — Root of the Dashboard
 * 
 * Sets up routing and the main layout (sidebar + content area).
 * All pages are now fully implemented.
 */

import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Shield, Server, AlertTriangle, BarChart3, Globe, Settings, Activity, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Overview from './pages/Overview.jsx';
import Servers from './pages/Servers.jsx';
import Alerts from './pages/Alerts.jsx';
import Websites from './pages/Websites.jsx';
import Threats from './pages/Threats.jsx';
import SettingsPage from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import './App.css';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

// Main Dashboard Layout
const DashboardLayout = ({ children }) => {
  const { logout, user } = useAuth();

  return (
    <div className="app-layout">
      {/* ---- Sidebar Navigation ---- */}
      <nav className="sidebar" id="main-sidebar">
        <div className="sidebar-brand">
          <Shield size={28} className="brand-icon" />
          <div>
            <h1 className="brand-title">AISD</h1>
            <span className="brand-subtitle">Security Dashboard</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end id="nav-overview">
            <BarChart3 size={18} />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/servers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-servers">
            <Server size={18} />
            <span>Servers</span>
          </NavLink>
          <NavLink to="/websites" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-websites">
            <Globe size={18} />
            <span>Websites</span>
          </NavLink>
          <NavLink to="/threats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-threats">
            <Activity size={18} />
            <span>AI Threats</span>
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-alerts">
            <AlertTriangle size={18} />
            <span>Alerts</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div style={{ padding: '0 8px 12px 8px', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Logged in as <b>{user?.email}</b>
          </div>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-settings">
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
          <button className="nav-item" onClick={logout} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-secondary)' }}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
          <div className="system-status" style={{ marginTop: '16px' }}>
            <span className="status-dot healthy"></span>
            <span className="status-text">System Healthy</span>
          </div>
        </div>
      </nav>

      {/* ---- Main Content Area ---- */}
      <main className="main-content" id="main-content">
        {children}
      </main>
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><DashboardLayout><Overview /></DashboardLayout></ProtectedRoute>} />
      <Route path="/servers" element={<ProtectedRoute><DashboardLayout><Servers /></DashboardLayout></ProtectedRoute>} />
      <Route path="/websites" element={<ProtectedRoute><DashboardLayout><Websites /></DashboardLayout></ProtectedRoute>} />
      <Route path="/threats" element={<ProtectedRoute><DashboardLayout><Threats /></DashboardLayout></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><DashboardLayout><Alerts /></DashboardLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><DashboardLayout><SettingsPage /></DashboardLayout></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
