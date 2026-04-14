import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/layout.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/sessions', icon: '💬', label: 'Sessions' },
  { to: '/mood', icon: '💜', label: 'Mood' },
  { to: '/cultural-mirror', icon: '◈', label: 'Cultural Mirror' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch {
      // Logout failed silently — user stays on page
    }
  };

  const displayName = currentUser?.displayName || currentUser?.email || 'User';

  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>Adaptive Wellness Companion</h2>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Desktop Top Bar */}
      <header className="topbar">
        <div />
        <div className="topbar-user">
          <span className="topbar-name">{displayName}</span>
          <button className="topbar-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className="mobile-topbar">
        <span className="mobile-topbar-title">Wellness Companion</span>
        <button className="mobile-topbar-logout" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Tabs */}
      <nav className="bottom-tabs">
        <div className="bottom-tabs-inner">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
            >
              <span className="tab-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
