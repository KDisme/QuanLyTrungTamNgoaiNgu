import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usersApi } from '../../api';
import { Avatar, StatusBadge, Loading } from '../../components/common';

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    usersApi.getById(parseInt(id || '0'))
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  if (!user) return <div>Không tìm thấy nhân viên</div>;

  const profile = user.staffProfile || {};

  return (
    <div>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate(`${portalBase}/staff`)}>
        <ArrowLeft size={14} /> Quay lại
      </button>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={user.full_name} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>{user.full_name}</h1>
              <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{profile.staff_code}</div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'VỊ TRÍ', value: profile.position || '—', color: '#10b981', bg: '#ecfdf5' },
          { label: 'CƠ SỞ', value: profile.branch_name || '—', color: '#2563eb', bg: '#eff6ff' },
          { label: 'NGÀY VÀO LÀM', value: profile.start_date ? new Date(profile.start_date).toLocaleDateString('vi-VN') : '—', color: '#f59e0b', bg: '#fffbeb' },
          { label: 'TRẠNG THÁI', value: user.is_active ? 'Đang làm việc' : 'Ngưng hoạt động', color: '#8b5cf6', bg: '#f5f3ff' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ flex: 1 }}>
              <div className="stat-value" style={{ fontSize: 18 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>●</div>
          </div>
        ))}
      </div>

      <div className="profile-section">
        <div className="profile-section-title">Thông tin cá nhân</div>
        <div className="info-grid">
          <div className="info-item"><label>Họ và tên</label><span>{user.full_name}</span></div>
          <div className="info-item"><label>Giới tính</label><span>{user.gender === 'male' ? 'Nam' : user.gender === 'female' ? 'Nữ' : 'Khác'}</span></div>
          <div className="info-item"><label>Ngày sinh</label><span>{user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('vi-VN') : '—'}</span></div>
          <div className="info-item"><label>Vị trí</label><span>{profile.position || '—'}</span></div>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-section-title">Thông tin liên hệ</div>
        <div className="info-grid">
          <div className="info-item"><label>Số điện thoại</label><span>{user.phone || '—'}</span></div>
          <div className="info-item"><label>Email</label><span>{user.email || '—'}</span></div>
          <div className="info-item"><label>Địa chỉ</label><span>{user.address || '—'}</span></div>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-section-title">Thông tin tài khoản</div>
        <div className="info-grid">
          <div className="info-item"><label>Tài khoản ngân hàng</label><span>{profile.bank_account || '—'}</span></div>
          <div className="info-item"><label>Ngày vào làm</label><span>{profile.start_date ? new Date(profile.start_date).toLocaleDateString('vi-VN') : '—'}</span></div>
        </div>
      </div>
    </div>
  );
}
