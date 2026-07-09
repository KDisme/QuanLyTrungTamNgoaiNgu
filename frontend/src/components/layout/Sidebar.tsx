import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { notificationsApi } from '../../api';
import { getPrimaryRole, ROLE_LABELS, ROLE_NAV, ROLE_PORTAL_NAMES } from '../../config/roleConfig';

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Sidebar() {
  const { user, tenantName, tenantSlug, logout } = useAuth();
  const navigate = useNavigate();
  const role = getPrimaryRole(user?.roles);
  const navGroups = ROLE_NAV[role];
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const hasNotificationsNav = navGroups.some((group) => group.items.some((item) => item.to.endsWith('notifications')));
    if (!hasNotificationsNav) return;
    const fetchUnread = () => {
      notificationsApi.unreadCount().then((res) => setUnreadCount(res.data.unreadCount || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [navGroups]);

  const handleLogout = () => {
    logout();
    navigate(`/${tenantSlug}/login`);
  };

  const base = `/${tenantSlug}`;

  return (
    <aside className={`sidebar sidebar-${role}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          {tenantName?.[0] || 'T'}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div className="sidebar-title">{tenantName || 'Trung Tâm'}</div>
          <div className="sidebar-portal-name">{ROLE_PORTAL_NAMES[role]}</div>
        </div>
      </div>

      <div className={`portal-badge role-${role}`}>{ROLE_LABELS[role]}</div>

      <nav className="sidebar-nav">
        {navGroups.map(group => (
          <div key={group.section}>
            <div className="nav-section-label">{group.section}</div>
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={`${base}/${item.to}`}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon size={16} />
                {item.label}
                {item.to.endsWith('notifications') && unreadCount > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: 'var(--danger)', color: '#fff', borderRadius: 999,
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', minWidth: 18, textAlign: 'center',
                  }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={handleLogout} title="Đăng xuất">
          <div
            className="user-avatar"
            style={{ background: getAvatarColor(user?.fullName || 'U'), width: 32, height: 32 }}
          >
            {getInitials(user?.fullName || 'U')}
          </div>
          <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user?.fullName}</div>
            <div className="user-role">{ROLE_LABELS[role]}</div>
          </div>
          <LogOut size={14} style={{ color: '#64748b', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
