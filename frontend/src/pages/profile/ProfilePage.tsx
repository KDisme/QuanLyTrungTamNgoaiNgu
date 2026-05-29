import React from 'react';
import { Mail, Phone, UserCircle, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getPrimaryRole, ROLE_LABELS, ROLE_PORTAL_NAMES } from '../../config/roleConfig';

export default function ProfilePage() {
  const { user, tenantName } = useAuth();
  const role = getPrimaryRole(user?.roles);
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Hồ sơ cá nhân</h1>
        <div className="page-subtitle">Thông tin tài khoản đang đăng nhập</div>
      </div>
      <div className="card profile-card">
        <div className="profile-avatar"><UserCircle size={44} /></div>
        <div>
          <h2>{user?.fullName}</h2>
          <p>{tenantName}</p>
          <div className="profile-info-grid">
            <div><Mail size={16} /> <span>{user?.email || 'Chưa cập nhật email'}</span></div>
            <div><Phone size={16} /> <span>{user?.phone || 'Chưa cập nhật SĐT'}</span></div>
            <div><Shield size={16} /> <span>{ROLE_LABELS[role]} · {ROLE_PORTAL_NAMES[role]}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
