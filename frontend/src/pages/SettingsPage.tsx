import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function SettingsPage() {
  const { user, tenantName, tenantSlug } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cài đặt</h1>
        <p className="page-subtitle">Quản lý thông tin trung tâm và cài đặt hệ thống</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>🏢 Thông tin trung tâm</h3>
          <div className="info-grid">
            {[
              { label: 'TÊN TRUNG TÂM', val: tenantName || '—' },
              { label: 'SLUG', val: `/${tenantSlug}` },
            ].map(i => (
              <div key={i.label} className="info-item"><label>{i.label}</label><span>{i.val}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>👤 Thông tin tài khoản</h3>
          <div className="info-grid">
            {[
              { label: 'HỌ TÊN', val: user?.fullName || '—' },
              { label: 'EMAIL', val: user?.email || '—' },
              { label: 'VAI TRÒ', val: user?.roles?.join(', ') || '—' },
            ].map(i => (
              <div key={i.label} className="info-item"><label>{i.label}</label><span>{i.val}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
