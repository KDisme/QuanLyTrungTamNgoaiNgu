import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, User, Building2 } from 'lucide-react';
import { schedulesApi, attendanceApi } from '../../api';
import { Loading } from '../../components/common';
import toast from 'react-hot-toast';

const STATUS_OPTS = [
  { v: 'present', l: '✓ Có mặt', cls: 'att-btn present' },
  { v: 'absent',  l: '✕ Vắng',   cls: 'att-btn absent' },
  { v: 'late',    l: '⏱ Muộn',   cls: 'att-btn late' },
  { v: 'excused', l: '! Có phép', cls: 'att-btn excused' },
];

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  present: { bg: '#dcfce7', color: '#16a34a', label: 'Có mặt' },
  absent:  { bg: '#fee2e2', color: '#dc2626', label: 'Vắng' },
  late:    { bg: '#fef3c7', color: '#d97706', label: 'Muộn' },
  excused: { bg: '#f5f3ff', color: '#7c3aed', label: 'Có phép' },
};

function daysBetween(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

const WEEKDAY_VI = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function AttendanceTakePage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;

  const [schedule, setSchedule] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<number, { status: string; note: string }>>({});
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (!scheduleId) return;
    setLoadingSchedule(true);
    try {
      const res = await schedulesApi.getById(parseInt(scheduleId));
      setSchedule(res.data);
    } catch {
      toast.error('Không tìm thấy buổi học');
      navigate(`${portalBase}/attendance`);
    } finally {
      setLoadingSchedule(false);
    }
  }, [scheduleId, navigate, tenantSlug]);

  const loadStudents = useCallback(async () => {
    if (!scheduleId) return;
    setLoadingStudents(true);
    try {
      const res = await attendanceApi.getBySchedule(parseInt(scheduleId));
      setStudents(res.data);
      const init: Record<number, { status: string; note: string }> = {};
      res.data.forEach((s: any) => {
        if (s.student_id) {
          init[s.student_id] = { status: s.status || 'present', note: s.note || '' };
        }
      });
      setRecords(init);
    } catch {
      toast.error('Không thể tải danh sách học viên');
    } finally {
      setLoadingStudents(false);
    }
  }, [scheduleId]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);
  useEffect(() => { if (schedule) loadStudents(); }, [schedule, loadStudents]);

  const setStatus = (studentId: number, status: string) => {
    setRecords(r => ({ ...r, [studentId]: { ...r[studentId], status } }));
  };

  const setNote = (studentId: number, note: string) => {
    setRecords(r => ({ ...r, [studentId]: { ...r[studentId], note } }));
  };

  const handleSave = async () => {
    if (!scheduleId) return;
    setSaving(true);
    try {
      const recs = students.map((s: any) => {
        const sid = s.student_id;
        return {
          studentId: sid,
          status: records[sid]?.status || 'present',
          note: records[sid]?.note || null,
        };
      });
      await attendanceApi.save(parseInt(scheduleId), recs);
      toast.success('Lưu điểm danh thành công!');
      navigate(`${portalBase}/attendance`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  // Stats
  const countByStatus = (status: string) =>
    Object.values(records).filter(r => r.status === status).length;
  const presentCount = countByStatus('present');
  const absentCount  = countByStatus('absent');
  const lateCount    = countByStatus('late');
  const excusedCount = countByStatus('excused');

  if (loadingSchedule) {
    return (
      <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  if (!schedule) return null;

  const sessionDate = new Date(schedule.session_date);
  const diff = daysBetween(schedule.session_date);
  const weekday = WEEKDAY_VI[sessionDate.getDay()];
  const dateStr = sessionDate.toLocaleDateString('vi-VN');

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Điểm danh</h1>
          <p className="page-subtitle">Điểm danh cho buổi học</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(`${portalBase}/attendance`)}>
          <ArrowLeft size={14} /> Quay lại
        </button>
      </div>

      {/* Schedule info card */}
      <div className="card" style={{ marginBottom: 16 }}>
        {/* Days badge */}
        {diff > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#eff6ff', color: '#2563eb',
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, marginBottom: 12,
          }}>
            📅 Còn {diff} ngày
          </div>
        )}
        {diff === 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#dcfce7', color: '#16a34a',
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, marginBottom: 12,
          }}>
            🟢 Hôm nay
          </div>
        )}
        {diff < 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#f3f4f6', color: '#6b7280',
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, marginBottom: 12,
          }}>
            ✓ Đã qua
          </div>
        )}

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
          {schedule.class_name}
        </h2>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 13 }}>
            <Calendar size={14} color="#2563eb" />
            <span style={{ fontWeight: 600 }}>{weekday}, {dateStr}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 13 }}>
            <Clock size={14} color="#2563eb" />
            <span style={{ fontWeight: 600 }}>{schedule.start_time?.slice(0,5)} – {schedule.end_time?.slice(0,5)}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{
            background: '#f8fafc', borderRadius: 10, padding: '12px 16px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <MapPin size={13} color="#6b7280" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Phòng học</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{schedule.room_name || 'N/A'}</div>
          </div>
          <div style={{
            background: '#f8fafc', borderRadius: 10, padding: '12px 16px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <User size={13} color="#6b7280" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Giáo viên</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{schedule.teacher_name || 'N/A'}</div>
          </div>
          <div style={{
            background: '#f8fafc', borderRadius: 10, padding: '12px 16px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Building2 size={13} color="#6b7280" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cơ sở</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{schedule.branch_name || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 10 }}>Thống kê</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { label: 'Tổng số', value: students.length, bg: '#eff6ff', color: '#2563eb', icon: '👥' },
            { label: 'Có mặt',  value: presentCount,    bg: '#dcfce7', color: '#16a34a', icon: '✓' },
            { label: 'Vắng',    value: absentCount,     bg: '#fee2e2', color: '#dc2626', icon: '✕' },
            { label: 'Muộn',    value: lateCount,       bg: '#fef3c7', color: '#d97706', icon: '⏱' },
            { label: 'Có phép', value: excusedCount,    bg: '#f5f3ff', color: '#7c3aed', icon: '!' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'white', border: `1px solid ${stat.bg}`,
              borderRadius: 12, padding: '14px 10px', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: stat.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px', fontSize: 18,
              }}>{stat.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Student list */}
      <div className="card" style={{ padding: 0, marginBottom: 80 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Danh sách học viên ({students.length})</h3>
        </div>

        {loadingStudents ? (
          <div style={{ padding: 40 }}><Loading /></div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            Chưa có học viên trong lớp này
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>STT</th>
                  <th style={{ width: 90 }}>Mã HV</th>
                  <th>Họ tên</th>
                  <th style={{ width: 110 }}>Ngày sinh</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s: any, idx: number) => {
                  const sid = s.student_id;
                  const rec = records[sid] || { status: 'present', note: '' };
                  const statusInfo = STATUS_COLOR[rec.status] || STATUS_COLOR.present;
                  return (
                    <tr key={sid}>
                      <td style={{ fontWeight: 600, color: '#9ca3af', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{s.student_code || 'N/A'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.full_name}</div>
                      </td>
                      <td style={{ color: '#6b7280', fontSize: 13 }}>
                        {s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {STATUS_OPTS.map(opt => (
                            <button
                              key={opt.v}
                              onClick={() => setStatus(sid, opt.v)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                border: `1.5px solid ${rec.status === opt.v ? STATUS_COLOR[opt.v]?.color : '#e5e7eb'}`,
                                background: rec.status === opt.v ? STATUS_COLOR[opt.v]?.bg : 'white',
                                color: rec.status === opt.v ? STATUS_COLOR[opt.v]?.color : '#9ca3af',
                                cursor: 'pointer',
                                fontFamily: 'var(--font)',
                                transition: 'all 0.12s',
                              }}
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          className="form-input"
                          style={{ fontSize: 12, padding: '6px 10px' }}
                          placeholder="Nhập ghi chú..."
                          value={rec.note}
                          onChange={e => setNote(sid, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 'var(--sidebar-width)', right: 0,
        background: 'white', borderTop: '1px solid #e5e7eb',
        padding: '12px 24px',
        display: 'flex', justifyContent: 'flex-end', gap: 10,
        zIndex: 50,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      }}>
        <button className="btn btn-secondary" onClick={() => navigate(`${portalBase}/attendance`)}>
          Hủy
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || students.length === 0}
          style={{ minWidth: 140 }}
        >
          {saving ? 'Đang lưu...' : '💾 Lưu điểm danh'}
        </button>
      </div>
    </div>
  );
}
