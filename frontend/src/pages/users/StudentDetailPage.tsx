import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usersApi, classesApi, attendanceApi, feesApi } from '../../api';
import { Avatar, StatusBadge, Loading, Tabs, EmptyState } from '../../components/common';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [classes, setClasses] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    usersApi.getById(parseInt(id || '0'))
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    classesApi.getByStudent(parseInt(id)).then((res) => setClasses(res.data)).catch(() => setClasses([]));
    attendanceApi.getStudentAttendance(parseInt(id)).then((res) => setAttendance(res.data)).catch(() => setAttendance([]));
    feesApi.getStudentCollections(parseInt(id)).then((res) => setFees(res.data)).catch(() => setFees([]));
  }, [id]);

  if (loading) return <Loading />;
  if (!user) return <div>Không tìm thấy học viên</div>;

  const profile = user.studentProfile || {};
  const stats = user.stats?.student || {};
  const attendanceRate = stats.totalSessions ? Math.round(((stats.presentCount + stats.lateCount) / stats.totalSessions) * 100) : 0;

  const TABS = [
    { id: 'info', label: 'Thông tin' },
    { id: 'classes', label: 'Lớp học', count: classes.length },
    { id: 'attendance', label: 'Điểm danh', count: attendance.length },
    { id: 'fees', label: 'Đợt thu', count: fees.length },
  ];

  return (
    <div>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate(`${portalBase}/students`)}>
        <ArrowLeft size={14} /> Quay lại
      </button>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={user.full_name} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>{user.full_name}</h1>
              <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{profile.student_code}</div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'LỚP ĐANG HỌC', value: stats.classCount || 0, color: '#2563eb', bg: '#eff6ff' },
          { label: 'TỶ LỆ CÓ MẶT', value: `${attendanceRate}%`, color: '#10b981', bg: '#ecfdf5' },
          { label: 'TỔNG BUỔI ĐIỂM DANH', value: stats.totalSessions || 0, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'BUỔI VẮNG', value: stats.absentCount || 0, color: '#ef4444', bg: '#fef2f2' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ flex: 1 }}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>●</div>
          </div>
        ))}
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'info' && (
        <>
          <div className="profile-section">
            <div className="profile-section-title">Thông tin cá nhân</div>
            <div className="info-grid">
              <div className="info-item"><label>Họ và tên</label><span>{user.full_name}</span></div>
              <div className="info-item"><label>Giới tính</label><span>{user.gender === 'male' ? 'Nam' : user.gender === 'female' ? 'Nữ' : 'Khác'}</span></div>
              <div className="info-item"><label>Ngày sinh</label><span>{user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('vi-VN') : '—'}</span></div>
              <div className="info-item"><label>Trạng thái học tập</label><span>{profile.study_status || '—'}</span></div>
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
            <div className="profile-section-title">Hồ sơ học vụ</div>
            <div className="info-grid">
              <div className="info-item"><label>Ngày nhập học</label><span>{profile.enrollment_date ? new Date(profile.enrollment_date).toLocaleDateString('vi-VN') : '—'}</span></div>
              <div className="info-item"><label>Ghi chú</label><span>{profile.notes || '—'}</span></div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'classes' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead><tr><th>LỚP</th><th>CƠ SỞ</th><th>TRẠNG THÁI</th></tr></thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr><td colSpan={3}><EmptyState message="Chưa có lớp học" /></td></tr>
                ) : classes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.branch_name}</td>
                    <td><StatusBadge status={c.student_status || c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead><tr><th>NGÀY</th><th>LỚP</th><th>TRẠNG THÁI</th></tr></thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr><td colSpan={3}><EmptyState message="Chưa có dữ liệu điểm danh" /></td></tr>
                ) : attendance.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.session_date).toLocaleDateString('vi-VN')}</td>
                    <td>{a.class_name}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead><tr><th>ĐỢT THU</th><th>LỚP</th><th>SỐ TIỀN</th><th>TRẠNG THÁI</th></tr></thead>
              <tbody>
                {fees.length === 0 ? (
                  <tr><td colSpan={4}><EmptyState message="Chưa có dữ liệu học phí" /></td></tr>
                ) : fees.map((f) => (
                  <tr key={f.id}>
                    <td>{f.collection_name}</td>
                    <td>{f.class_name || '—'}</td>
                    <td>{Number(f.amount_paid || 0).toLocaleString('vi-VN')} / {Number(f.amount_due || 0).toLocaleString('vi-VN')}</td>
                    <td><StatusBadge status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
