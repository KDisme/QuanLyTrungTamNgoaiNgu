import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, UserMinus } from 'lucide-react';
import { classesApi, schedulesApi, usersApi } from '../../api';
import { Avatar, StatusBadge, Tabs, Modal, Loading, EmptyState, ConfirmDialog } from '../../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

function formatDateOnly(value: any) {
  if (!value) return '—';
  const raw = String(value);
  let y = '', m = '', d = '';
  const plain = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) { [, y, m, d] = plain; }
  else if (raw.includes('T')) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      y = String(date.getFullYear());
      m = String(date.getMonth() + 1).padStart(2, '0');
      d = String(date.getDate()).padStart(2, '0');
    }
  } else {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) { [, y, m, d] = iso; }
  }
  return y ? `${d}/${m}/${y}` : '—';
}


function AddStudentModal({
  classId,
  currentCount,
  maxStudents,
  onClose,
  onSuccess,
}: {
  classId: number;
  currentCount: number;
  maxStudents: number | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersApi.getAll({ role: 'student', search, limit: 50 }).then(r => setStudents(r.data.users)).catch(() => {});
  }, [search]);

  const remainingSlots = maxStudents != null ? Math.max(0, maxStudents - currentCount) : null;
  const isFull = remainingSlots !== null && remainingSlots <= 0;

  const toggle = (id: number) => {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (remainingSlots !== null && s.length >= remainingSlots) {
        toast.error(`Lớp chỉ còn ${remainingSlots} chỗ trống, không thể chọn thêm.`);
        return s;
      }
      return [...s, id];
    });
  };

  const handleAdd = async () => {
    if (!selected.length) { toast.error('Chọn ít nhất 1 học viên'); return; }
    setLoading(true);
    try {
      await Promise.all(selected.map(id => classesApi.addStudent(classId, id)));
      toast.success(`Đã thêm ${selected.length} học viên`);
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Thêm học viên vào lớp" onClose={onClose} size="lg"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={handleAdd} disabled={loading || isFull || !selected.length}>{loading ? '...' : `Thêm ${selected.length} học viên`}</button></>}>

      {maxStudents != null && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderRadius: 8, marginBottom: 12,
          background: isFull ? '#fef2f2' : 'var(--primary-50)',
          color: isFull ? '#b91c1c' : 'var(--primary)', fontSize: 13, fontWeight: 600,
        }}>
          <span>Sĩ số hiện tại: {currentCount}/{maxStudents}</span>
          {isFull ? <span>🚫 Lớp đã đầy</span> : <span>Còn {remainingSlots} chỗ trống</span>}
        </div>
      )}

      <input className="form-input" style={{ marginBottom: 12 }} placeholder="Tìm học viên..." value={search} onChange={e => setSearch(e.target.value)} disabled={isFull} />
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {students.map(s => {
          const isSelected = selected.includes(s.id);
          const disableItem = isFull || (!isSelected && remainingSlots !== null && selected.length >= remainingSlots);
          return (
            <div key={s.id} onClick={() => !disableItem && toggle(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 8, cursor: disableItem ? 'not-allowed' : 'pointer', marginBottom: 4,
              background: isSelected ? 'var(--primary-50)' : 'var(--gray-50)',
              border: `1.5px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
              opacity: disableItem ? 0.5 : 1,
              transition: 'all 0.12s'
            }}>
              <Avatar name={s.full_name} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.student_code} · {s.phone}</div>
              </div>
              {isSelected && <div style={{ width: 20, height: 20, background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>✓</div>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStudent = user?.roles?.includes('student') ?? false;
  const isTeacher = user?.roles?.includes('teacher') ?? false;
  const canManageClassStudents = user?.roles?.some((role) => ['admin', 'staff'].includes(role)) ?? false;
  const canTakeAttendance = canManageClassStudents || isTeacher;
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;
  const classListPath = isStudent || isTeacher ? `${portalBase}/my-classes` : `${portalBase}/classes`;
  const schedulePath = isStudent || isTeacher ? `${portalBase}/my-schedule` : `${portalBase}/schedules`;
  const [cls, setCls] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [removingStudent, setRemovingStudent] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [clsRes, schRes] = await Promise.all([
        classesApi.getById(parseInt(id!)),
        schedulesApi.getByClass(parseInt(id!)),
      ]);
      setCls(clsRes.data);
      setSchedules(schRes.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleRemoveStudent = async () => {
    try {
      await classesApi.removeStudent(parseInt(id!), removingStudent.id);
      toast.success('Đã xoá học viên khỏi lớp');
      setRemovingStudent(null); load();
    } catch { toast.error('Không thể xoá'); }
  };

  if (loading) return <Loading />;
  if (!cls) return <div>Không tìm thấy lớp học</div>;

  const progress = cls.expected_sessions ? Math.round(((cls.schedules?.filter((s: any) => s.status === 'completed').length || 0) / cls.expected_sessions) * 100) : 0;

  const TABS = [
    { id: 'info', label: 'Thông tin' },
    { id: 'teachers', label: 'Giáo viên', count: cls.teachers?.length || 0 },
    ...(!isStudent ? [{ id: 'students', label: 'Học viên', count: cls.students?.length || 0 }] : []),
    { id: 'schedules', label: 'Lịch học', count: schedules.length },
    ...(canTakeAttendance ? [{ id: 'attendance', label: 'Điểm danh' }] : []),
  ];

  return (
    <div>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate(classListPath)}>
        <ArrowLeft size={14} /> Quay lại
      </button>

      {/* Header banner */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <StatusBadge status={cls.status} />
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                {cls.class_type === 'fixed' ? '📅 Có thời hạn' : '♾️ Không thời hạn'}
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{cls.name}</h1>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{cls.code} · {cls.branch_name}</div>
          </div>
          {canManageClassStudents && (
            <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>✏️ Chỉnh sửa</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
          {[
            { label: 'Giáo viên', value: cls.teachers?.length || 0 },
            { label: 'Học viên', value: isStudent ? '—' : `${cls.students?.length || 0}/${cls.max_students}` },
            { label: 'Buổi đã học', value: `${cls.schedules?.filter((s: any) => s.status === 'completed').length || 0}/${cls.expected_sessions || '∞'}` },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {cls.expected_sessions && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Tiến độ: {progress}%</div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#fbbf24', borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Info tab */}
      {activeTab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="profile-section-title">📋 Thông tin lớp học</div>
            <div className="info-grid">
              {[
                { label: 'Tên lớp', val: cls.name },
                { label: 'Mã lớp', val: cls.code },
                { label: 'Loại lớp', val: cls.class_type === 'fixed' ? 'Có thời hạn' : 'Không thời hạn' },
                { label: 'Ngày bắt đầu', val: formatDateOnly(cls.start_date) },
                { label: 'Ngày kết thúc', val: formatDateOnly(cls.end_date) },
                { label: 'Số buổi', val: cls.expected_sessions || '—' },
              ].map(i => (
                <div key={i.label} className="info-item"><label>{i.label}</label><span>{i.val}</span></div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="profile-section-title">📅 Lịch học tuần mẫu</div>
            {(cls.weekly_schedules || []).length === 0
              ? <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Chưa có lịch học tuần mẫu</div>
              : (cls.weekly_schedules || []).map((w: any) => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ fontWeight: 600 }}>Thứ {w.weekday === 0 ? 'CN' : w.weekday + 1}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{w.start_time?.slice(0,5)} - {w.end_time?.slice(0,5)}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{w.room_name || '—'}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Teachers tab */}
      {activeTab === 'teachers' && (
        <div className="card">
          <div className="profile-section-title">👨‍🏫 Giáo viên phụ trách</div>
          {cls.teachers?.length === 0
            ? <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Chưa có giáo viên</div>
            : cls.teachers?.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <Avatar name={t.full_name} size={36} />
                <div>
                  <div style={{ fontWeight: 600 }}>{t.full_name}</div>
                </div>
                {t.is_primary && <span style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--primary-50)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 20, fontWeight: 600 }}>Chính</span>}
              </div>
            ))}
        </div>
      )}

      {/* Students tab */}
      {!isStudent && activeTab === 'students' && (
        <div>
          {canManageClassStudents && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddStudent(true)}
                disabled={cls.max_students != null && (cls.students?.filter((s: any) => s.status === 'active').length || 0) >= cls.max_students}
              >
                <Plus size={13} /> Thêm học viên
              </button>
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead><tr><th>HỌC VIÊN</th><th>SĐT</th><th>NGÀY VÀO</th><th>TRẠNG THÁI</th><th></th></tr></thead>
                <tbody>
                  {cls.students?.length === 0
                    ? <tr><td colSpan={5}><EmptyState message="Chưa có học viên nào" /></td></tr>
                    : cls.students?.map((s: any) => (
                      <tr key={s.id}>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={s.full_name} size={32} /><span style={{ fontWeight: 600 }}>{s.full_name}</span></div></td>
                        <td style={{ fontSize: 13 }}>{s.phone}</td>
                        <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>{s.joined_at ? new Date(s.joined_at).toLocaleDateString('vi-VN') : '—'}</td>
                        <td><StatusBadge status={s.status} /></td>
                        {canManageClassStudents && (
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => setRemovingStudent(s)}><UserMinus size={12} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Schedules tab */}
      {activeTab === 'schedules' && (
        <div>
          {canManageClassStudents && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(schedulePath)}><Plus size={13} /> Tạo lịch</button>
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead><tr><th>BUỔI</th><th>NGÀY</th><th>GIỜ</th><th>PHÒNG</th><th>GIÁO VIÊN</th><th>TRẠNG THÁI</th></tr></thead>
                <tbody>
                  {schedules.length === 0
                    ? <tr><td colSpan={6}><EmptyState message="Chưa có lịch học nào" /></td></tr>
                    : schedules.map((s: any) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>#{s.session_number}</td>
                        <td>{formatDateOnly(s.session_date)}</td>
                        <td style={{ fontSize: 13 }}>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</td>
                        <td style={{ fontSize: 13 }}>{s.room_name || '—'}</td>
                        <td style={{ fontSize: 13 }}>{s.teacher_name || '—'}</td>
                        <td><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Attendance tab */}
      {canTakeAttendance && activeTab === 'attendance' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead><tr><th>NGÀY</th><th>GIỜ</th><th>ĐIỂM DANH</th><th></th></tr></thead>
              <tbody>
                {schedules.length === 0
                  ? <tr><td colSpan={4}><EmptyState message="Chưa có buổi học" /></td></tr>
                  : schedules.map((s: any) => {
                    const total = parseInt(s.student_count || 0);
                    const attended = parseInt(s.attended_count || 0);
                    const rate = total ? Math.round((attended / total) * 100) : 0;
                    return (
                      <tr key={s.id}>
                        <td>{formatDateOnly(s.session_date)}</td>
                        <td style={{ fontSize: 13 }}>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</td>
                        <td>{total ? `${rate}% (${attended}/${total})` : '—'}</td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => navigate(`${portalBase}/attendance?scheduleId=${s.id}`)}>Điểm danh</button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManageClassStudents && showAddStudent && (
        <AddStudentModal
          classId={parseInt(id!)}
          currentCount={cls.students?.filter((s: any) => s.status === 'active').length || 0}
          maxStudents={cls.max_students ?? null}
          onClose={() => setShowAddStudent(false)}
          onSuccess={load}
        />
      )}
      {canManageClassStudents && removingStudent && <ConfirmDialog message={`Xoá "${removingStudent.full_name}" khỏi lớp?`} onConfirm={handleRemoveStudent} onCancel={() => setRemovingStudent(null)} />}
    </div>
  );
}
