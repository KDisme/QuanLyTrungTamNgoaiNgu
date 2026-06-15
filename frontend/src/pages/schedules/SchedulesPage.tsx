import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, List, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { schedulesApi, classesApi, branchesApi, usersApi } from '../../api';
import { StatusBadge, Modal, Loading, EmptyState, ConfirmDialog } from '../../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

const SHOW_BRANCH_UI = true;

const WEEKDAYS = [
  { v: 1, l: 'Thứ 2' }, { v: 2, l: 'Thứ 3' }, { v: 3, l: 'Thứ 4' },
  { v: 4, l: 'Thứ 5' }, { v: 5, l: 'Thứ 6' }, { v: 6, l: 'Thứ 7' }, { v: 0, l: 'CN' },
];


function toDateInputValue(value: any) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw.includes('T')) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function formatDateOnly(value: any) {
  const key = toDateInputValue(value);
  if (!key) return '—';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}
function toDateKey(value: string) {
  return toDateInputValue(value);
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

function formatDateUTC(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateUTC(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fDefaultDate() {
  return formatDateLocal(new Date());
}

function addDays(dateStr: string, days: number) {
  if (!dateStr) return '';
  const d = parseDateUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateUTC(d);
}

function buildCalendar(date: Date) {
  const { start, end } = getMonthRange(date);
  const startOffset = (start.getDay() + 6) % 7; // Monday start
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= end.getDate(); d++) cells.push(new Date(date.getFullYear(), date.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function ScheduleWizardModal({ classes, branches, onClose, onSuccess }: { classes: any[]; branches: any[]; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    classId: '',
    fromDate: '',
    toDate: '',
    weekdays: [] as number[],
    startTime: '08:00',
    endTime: '10:00',
    branchId: '',
    roomId: '',
    teacherId: '',
    useWeeklyTemplate: true,
  });
  const [rooms, setRooms] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);


  useEffect(() => {
    if (!form.branchId && branches[0]?.id) {
      setForm((f) => ({ ...f, branchId: String(branches[0].id) }));
    }
  }, [branches, form.branchId]);

  useEffect(() => {
    usersApi.getAll({ role: 'teacher', limit: 200 }).then(r => setTeachers(r.data.users)).catch(() => setTeachers([]));
  }, []);

  useEffect(() => {
    if (!form.branchId) return;
    branchesApi.getById(parseInt(form.branchId)).then(r => setRooms(r.data.rooms || [])).catch(() => setRooms([]));
  }, [form.branchId]);

  useEffect(() => {
    if (!form.classId) return;
    const id = parseInt(form.classId);
    if (isNaN(id)) return;

    classesApi.getById(id)
      .then((res) => {
        const cls = res.data;
        if (!cls) return;
        setSelectedClass(cls);
        const weekly = cls.weekly_schedules || [];
        const firstWeekly = weekly[0];
        const allSameTime = weekly.length > 0 && weekly.every((w: any) => String(w.start_time).slice(0,5) === String(firstWeekly.start_time).slice(0,5) && String(w.end_time).slice(0,5) === String(firstWeekly.end_time).slice(0,5));
        const allSameRoom = weekly.length > 0 && weekly.every((w: any) => String(w.room_id || '') === String(firstWeekly.room_id || ''));
        const primaryTeacher = (cls.teachers || []).find((t: any) => t.is_primary) || (cls.teachers || [])[0];
        const start = toDateInputValue(cls.start_date) || fDefaultDate();
        const defaultEnd = toDateInputValue(cls.end_date) || addDays(start, 30);
        setForm((f) => ({
          ...f,
          fromDate: start || f.fromDate,
          toDate: defaultEnd || f.toDate,
          branchId: cls.branch_id ? String(cls.branch_id) : f.branchId,
          weekdays: weekly.length ? weekly.map((w: any) => Number(w.weekday)) : f.weekdays,
          startTime: allSameTime ? String(firstWeekly.start_time).slice(0,5) : f.startTime,
          endTime: allSameTime ? String(firstWeekly.end_time).slice(0,5) : f.endTime,
          roomId: allSameRoom && firstWeekly?.room_id ? String(firstWeekly.room_id) : f.roomId,
          teacherId: primaryTeacher?.id ? String(primaryTeacher.id) : f.teacherId,
          useWeeklyTemplate: weekly.length > 0,
        }));
      })
      .catch(() => {});
  }, [form.classId]);

  useEffect(() => {
    setPreview(null);
  }, [form.classId, form.fromDate, form.toDate, form.weekdays.join(','), form.startTime, form.endTime, form.roomId, form.teacherId, form.useWeeklyTemplate]);

  const toggleWeekday = (d: number) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter(x => x !== d) : [...f.weekdays, d],
    }));
  };

  const handlePreview = async () => {
    if (!form.classId || !form.fromDate || !form.toDate) { toast.error('Vui lòng chọn lớp và khoảng thời gian'); return; }
    if (form.fromDate > form.toDate) { toast.error('Từ ngày phải nhỏ hơn hoặc bằng đến ngày'); return; }
    if (!form.useWeeklyTemplate && !form.weekdays.length) { toast.error('Vui lòng chọn ngày học trong tuần'); return; }
    if (!form.useWeeklyTemplate && form.startTime >= form.endTime) { toast.error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc'); return; }
    if (!form.teacherId) { toast.error('Vui lòng chọn giáo viên'); return; }
    setLoading(true);
    try {
      const res = await schedulesApi.preview(parseInt(form.classId), {
        fromDate: form.fromDate,
        toDate: form.toDate,
        useWeeklyTemplate: form.useWeeklyTemplate,
        weekdays: form.useWeeklyTemplate ? undefined : form.weekdays,
        startTime: form.useWeeklyTemplate ? undefined : form.startTime,
        endTime: form.useWeeklyTemplate ? undefined : form.endTime,
        roomId: form.useWeeklyTemplate ? undefined : (form.roomId || null),
        teacherId: form.teacherId || null,
      });
      setPreview(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xem trước');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await schedulesApi.generate(parseInt(form.classId), {
        fromDate: form.fromDate,
        toDate: form.toDate,
        useWeeklyTemplate: form.useWeeklyTemplate,
        weekdays: form.useWeeklyTemplate ? undefined : form.weekdays,
        startTime: form.useWeeklyTemplate ? undefined : form.startTime,
        endTime: form.useWeeklyTemplate ? undefined : form.endTime,
        roomId: form.useWeeklyTemplate ? undefined : (form.roomId || null),
        teacherId: form.teacherId || null,
      });
      toast.success(`Đã tạo ${res.data.length} buổi học`);
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tạo lịch');
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Tạo lịch học tự động" onClose={onClose} size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          {step > 1 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Quay lại</button>}
          {step < 3 && <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Tiếp theo</button>}
          {step === 3 && (
            <button className="btn btn-primary" onClick={preview ? handleCreate : handlePreview} disabled={loading || (preview && preview.conflictCount > 0)}>
              {preview ? `Tạo lịch (${preview.total} buổi)` : 'Xem trước'}
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= n ? 'var(--primary)' : 'var(--gray-200)', color: step >= n ? 'white' : 'var(--gray-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{n}</div>
            {n < 3 && <div style={{ width: 40, height: 2, background: step > n ? 'var(--primary)' : 'var(--gray-200)' }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="form-group">
            <label className="form-label">Chọn lớp học</label>
            <select className="form-select" value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}>
              <option value="">-- Chọn lớp học --</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Từ ngày</label>
              <input className="form-input" type="date" value={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Đến ngày</label>
              <input className="form-input" type="date" value={form.toDate} onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {selectedClass?.weekly_schedules?.length > 0 && (
            <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                <input type="checkbox" checked={form.useWeeklyTemplate} onChange={(e) => setForm((f) => ({ ...f, useWeeklyTemplate: e.target.checked }))} />
                Dùng lịch tuần mẫu của lớp
              </label>
              <div style={{ fontSize: 12, marginTop: 8, color: 'var(--gray-600)' }}>
                {selectedClass.weekly_schedules.map((w: any) => `${WEEKDAYS.find(d => d.v === Number(w.weekday))?.l}: ${String(w.start_time).slice(0,5)}-${String(w.end_time).slice(0,5)}${w.room_name ? ` · ${w.room_name}` : ''}`).join(' | ')}
              </div>
            </div>
          )}
          <div className="form-group" style={{ opacity: form.useWeeklyTemplate ? 0.55 : 1 }}>
            <label className="form-label">Chọn các ngày trong tuần</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WEEKDAYS.map(d => (
                <button key={d.v} type="button" disabled={form.useWeeklyTemplate} onClick={() => toggleWeekday(d.v)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${form.weekdays.includes(d.v) ? 'var(--primary)' : 'var(--gray-200)'}`,
                    background: form.weekdays.includes(d.v) ? 'var(--primary)' : 'white',
                    color: form.weekdays.includes(d.v) ? 'white' : 'var(--gray-600)',
                    fontSize: 13, fontWeight: 600, cursor: form.useWeeklyTemplate ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)'
                  }}>{d.l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          {form.useWeeklyTemplate && (
            <div style={{ background: 'var(--primary-50)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
              Đang dùng giờ/phòng từ lịch tuần mẫu của lớp. Giáo viên có thể giữ theo giáo viên chính hoặc chọn giáo viên thay thế bên dưới.
            </div>
          )}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Giờ bắt đầu</label>
              <input className="form-input" type="time" value={form.startTime} disabled={form.useWeeklyTemplate} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Giờ kết thúc</label>
              <input className="form-input" type="time" value={form.endTime} disabled={form.useWeeklyTemplate} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            {SHOW_BRANCH_UI && (
              <div className="form-group">
                <label className="form-label">Cơ sở</label>
                <select className="form-select" value={form.branchId} disabled={form.useWeeklyTemplate} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value, roomId: '' }))}>
                  <option value="">-- Chọn cơ sở --</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Phòng học</label>
              <select className="form-select" value={form.roomId} disabled={form.useWeeklyTemplate} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>
                <option value="">-- Không chọn --</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity || 0} chỗ)</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Giáo viên</label>
            <select className="form-select" value={form.teacherId} onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}>
              <option value="">-- Chọn giáo viên --</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>

          {preview && (
            <div style={{ marginTop: 12 }}>
              <div style={{ padding: 12, background: 'var(--primary-50)', borderRadius: 10, fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
                Tổng số buổi học sẽ tạo: {preview.total} buổi
                {preview.conflictCount > 0 && <span style={{ marginLeft: 8, color: 'var(--danger)' }}>({preview.conflictCount} xung đột)</span>}
              </div>
              <div className="card" style={{ padding: 0, marginTop: 10 }}>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>NGÀY</th>
                        <th>GIỜ</th>
                        <th>PHÒNG</th>
                        <th>GIÁO VIÊN</th>
                        <th>TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.slice(0, 10).map((s: any, idx: number) => (
                        <tr key={`${s.session_date}-${idx}`}>
                          <td>{idx + 1}</td>
                          <td>{formatDateOnly(s.session_date)}</td>
                          <td>{s.start_time} - {s.end_time}</td>
                          <td>{rooms.find((r) => r.id === s.room_id)?.name || '—'}</td>
                          <td>{teachers.find((t) => t.id === s.teacher_id)?.full_name || '—'}</td>
                          <td>
                            <span style={{
                              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: s.status === 'ok' ? 'var(--success-light)' : 'var(--danger-light)',
                              color: s.status === 'ok' ? 'var(--success)' : 'var(--danger)'
                            }}>
                              {s.status === 'ok' ? 'OK' : 'Xung đột'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.items.length > 10 && (
                  <div style={{ padding: 10, fontSize: 12, color: 'var(--gray-400)' }}>... và {preview.items.length - 10} buổi học khác</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function RescheduleModal({ schedule, rooms, teachers, onClose, onSuccess, mode }: { schedule: any; rooms: any[]; teachers: any[]; onClose: () => void; onSuccess: () => void; mode: 'full' | 'teacher' }) {
  const [form, setForm] = useState({
    sessionDate: toDateInputValue(schedule.session_date),
    startTime: schedule.start_time || '08:00',
    endTime: schedule.end_time || '10:00',
    roomId: schedule.room_id || '',
    teacherId: schedule.teacher_id || '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await schedulesApi.update(schedule.id, {
        sessionDate: form.sessionDate,
        startTime: form.startTime,
        endTime: form.endTime,
        roomId: form.roomId || null,
        teacherId: form.teacherId || null,
        reason: form.reason,
      });
      toast.success('Đã cập nhật lịch học');
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể cập nhật lịch');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={mode === 'teacher' ? 'Giáo viên thay thế' : 'Đổi lịch buổi học'} onClose={onClose} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Lưu thay đổi'}</button>
      </>}>
      {mode === 'full' && (
        <>
          <div className="form-group">
            <label className="form-label">Ngày mới</label>
            <input className="form-input" type="date" value={form.sessionDate} onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Giờ bắt đầu</label>
              <input className="form-input" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Giờ kết thúc</label>
              <input className="form-input" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Phòng học</label>
            <select className="form-select" value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>
              <option value="">-- Không chọn --</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity || 0} chỗ)</option>)}
            </select>
          </div>
        </>
      )}
      <div className="form-group">
        <label className="form-label">Giáo viên</label>
        <select className="form-select" value={form.teacherId} onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}>
          <option value="">-- Chọn giáo viên --</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Lý do đổi lịch</label>
        <textarea className="form-textarea" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Nhập lý do đổi lịch (không bắt buộc)" />
      </div>
    </Modal>
  );
}

function ScheduleDetailModal({ schedule, rooms, teachers, canManage, canTakeAttendance, onClose, onRefresh, onAttendance }: { schedule: any; rooms: any[]; teachers: any[]; canManage: boolean; canTakeAttendance: boolean; onClose: () => void; onRefresh: () => void; onAttendance: () => void }) {
  const [showReschedule, setShowReschedule] = useState<null | 'full' | 'teacher'>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setLoadingHistory(true);
    schedulesApi.history(schedule.id)
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [schedule.id]);

  const handleCancel = async () => {
    try {
      await schedulesApi.cancel(schedule.id, 'Hủy buổi');
      toast.success('Đã hủy buổi học');
      onRefresh(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể hủy buổi');
    }
  };

  const handleRestore = async () => {
    try {
      await schedulesApi.update(schedule.id, { status: 'scheduled' });
      toast.success('Đã khôi phục buổi học');
      onRefresh(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể khôi phục buổi');
    }
  };

  const isCancelled = schedule.status === 'cancelled';
  const isCompleted = schedule.status === 'completed';

  return (
    <>
      <Modal title={schedule.class_name || 'Chi tiết buổi học'} onClose={onClose} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
          {canManage && isCancelled && (
            <button className="btn btn-success" onClick={() => setShowRestore(true)}>
              🔄 Khôi phục buổi học
            </button>
          )}
          {!isCancelled && (
            <>
              {canTakeAttendance && <button className="btn btn-primary" onClick={onAttendance}>Điểm danh</button>}
              {canManage && (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowReschedule('teacher')}>GV thay thế</button>
                  <button className="btn btn-secondary" onClick={() => setShowReschedule('full')}>Đổi lịch</button>
                  {!isCompleted && (
                    <button className="btn btn-danger" onClick={() => setShowCancel(true)}>Hủy buổi</button>
                  )}
                </>
              )}
            </>
          )}
        </>}>
        {/* Status banner */}
        {isCancelled && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: '#dc2626', fontWeight: 600,
          }}>
            ⚠️ Buổi học này đã bị hủy. Bạn có thể khôi phục để đưa về trạng thái "Đã lên lịch".
          </div>
        )}
        {isCompleted && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: '#16a34a', fontWeight: 600,
          }}>
            ✅ Buổi học đã hoàn thành và đã ghi nhận điểm danh. Không thể hủy.
          </div>
        )}
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Ngày học</label>
            <div style={{ fontWeight: 700 }}>{new Date(schedule.session_date).toLocaleDateString('vi-VN')}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Thời gian</label>
            <div style={{ fontWeight: 700 }}>{schedule.start_time?.slice(0,5)} - {schedule.end_time?.slice(0,5)}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Phòng học</label>
            <div style={{ fontWeight: 700 }}>{schedule.room_name || rooms.find((r) => r.id === schedule.room_id)?.name || '—'}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Giáo viên</label>
            <div style={{ fontWeight: 700 }}>{schedule.teacher_name || teachers.find((t) => t.id === schedule.teacher_id)?.full_name || '—'}</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Lịch sử thay đổi</div>
          {loadingHistory ? <Loading /> : history.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Chưa có thay đổi nào</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h) => (
                <div key={h.id} style={{ padding: 10, border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{new Date(h.created_at).toLocaleString('vi-VN')}</div>
                  <div style={{ fontWeight: 600 }}>{h.change_type}</div>
                  {h.reason && <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{h.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {showReschedule && (
        <RescheduleModal
          schedule={schedule}
          rooms={rooms}
          teachers={teachers}
          mode={showReschedule}
          onClose={() => setShowReschedule(null)}
          onSuccess={onRefresh}
        />
      )}

      {showCancel && (
        <ConfirmDialog message="Bạn có chắc muốn hủy buổi học này?" onConfirm={handleCancel} onCancel={() => setShowCancel(false)} />
      )}

      {showRestore && (
        <ConfirmDialog
          message="Khôi phục buổi học này về trạng thái 'Đã lên lịch'?"
          onConfirm={handleRestore}
          onCancel={() => setShowRestore(false)}
        />
      )}
    </>
  );
}


export default function SchedulesPage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'list' | 'week' | 'day'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [filters, setFilters] = useState({ branchId: '', classId: '' });
  const [showWizard, setShowWizard] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const isStudent = userRoles.includes('student');
  const isTeacher = userRoles.includes('teacher');
  const canManageSchedules = userRoles.some((role) => ['admin', 'staff'].includes(role));
  const canTakeAttendance = userRoles.some((role) => ['admin', 'staff', 'teacher'].includes(role));
  const canViewBranches = canManageSchedules || isTeacher;
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getMonthRange(currentMonth);
      const scheduleParams: any = {
        fromDate: formatDateLocal(start),
        toDate: formatDateLocal(end),
        classId: filters.classId || undefined,
        limit: 1000,
      };

      // Học viên không có quyền xem danh sách cơ sở, nên không gửi branchId.
      // Giáo viên được xem cơ sở nhưng không được gọi danh sách user/teacher.
      if (SHOW_BRANCH_UI && canViewBranches && filters.branchId) scheduleParams.branchId = filters.branchId;

      const [listRes, clsRes] = await Promise.all([
        schedulesApi.getList(scheduleParams),
        classesApi.getAll({ limit: 200 }),
      ]);

      setSchedules(listRes.data.schedules || []);
      setClasses(clsRes.data.classes || []);

      if (canViewBranches) {
        const brRes = await branchesApi.getAll({ limit: 200 });
        const branchList = brRes.data.branches || [];
        setBranches(branchList);

        if (canManageSchedules) {
          const [teacherRes, roomList] = await Promise.all([
            usersApi.getAll({ role: 'teacher', limit: 200 }),
            Promise.all(branchList.map((b: any) => branchesApi.getById(b.id))),
          ]);
          setTeachers(teacherRes.data.users || []);
          setRooms(roomList.flatMap((r: any) => r.data.rooms || []));
        } else {
          setTeachers([]);
          setRooms([]);
        }
      } else {
        setBranches([]);
        setTeachers([]);
        setRooms([]);
      }
    } catch (err: any) {
      console.error('Load schedules failed', err);
      toast.error(err?.response?.data?.message || 'Không tải được lịch học');
      setSchedules([]);
    } finally { setLoading(false); }
  }, [currentMonth, filters.branchId, filters.classId, canViewBranches, canManageSchedules]);

  useEffect(() => { load(); }, [load]);

  const scheduleMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    schedules.filter(s => s.status !== 'cancelled').forEach((s) => {
      const key = toDateKey(s.session_date);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [schedules]);

  const calendarCells = useMemo(() => buildCalendar(currentMonth), [currentMonth]);
  const monthLabel = currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const todayKey = formatDateLocal(new Date());

  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }, [selectedDate]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const formatDateVi = (d: Date) => d.toLocaleDateString('vi-VN');

  const headerLabel = view === 'week'
    ? `Tuần ${formatDateVi(weekStart)} - ${formatDateVi(weekEnd)}`
    : view === 'day'
      ? `Ngày ${formatDateVi(selectedDate)}`
      : monthLabel;

  const prevLabel = view === 'week' ? 'Tuần trước' : view === 'day' ? 'Ngày trước' : 'Tháng trước';
  const nextLabel = view === 'week' ? 'Tuần sau' : view === 'day' ? 'Ngày sau' : 'Tháng sau';

  const handlePrev = () => {
    if (view === 'week') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 7);
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      return;
    }
    if (view === 'day') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      return;
    }
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNext = () => {
    if (view === 'week') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 7);
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      return;
    }
    if (view === 'day') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      return;
    }
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const weekSchedules = schedules.filter((s) => {
    if (s.status === 'cancelled') return false;
    const dateKey = toDateKey(s.session_date);
    return dateKey >= formatDateLocal(weekStart) && dateKey <= formatDateLocal(weekEnd);
  });

  const daySchedules = schedules.filter((s) =>
    s.status !== 'cancelled' && toDateKey(s.session_date) === formatDateLocal(selectedDate)
  );

  const agendaToday = (scheduleMap[todayKey] || []).filter((s) => s.status !== 'cancelled');
  const agendaUpcoming = schedules.filter((s) => s.status !== 'cancelled' && toDateKey(s.session_date) > todayKey).slice(0, 5);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">{isStudent ? 'Lịch học của tôi' : isTeacher ? 'Lịch dạy của tôi' : 'Lịch học Tổng hợp'}</h1>
          <p className="page-subtitle">
            {isStudent
              ? 'Xem lịch học của các lớp bạn đang tham gia'
              : isTeacher
                ? 'Xem lịch dạy và điểm danh các buổi học bạn phụ trách'
                : 'Quản lý và xem lịch học của tất cả các lớp'}
          </p>
        </div>
        {canManageSchedules && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary">Ngày nghỉ</button>
            <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
              <Plus size={15} /> Tạo lịch tự động
            </button>
          </div>
        )}
      </div>

      <div className="filter-bar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {SHOW_BRANCH_UI && canViewBranches && (
            <select className="form-select" style={{ width: 180 }} value={filters.branchId} onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value }))}>
              <option value="">Cơ sở: Tất cả</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="form-select" style={{ width: 220 }} value={filters.classId} onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value }))}>
            <option value="">Lớp: Tất cả</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('list')}><List size={14} /> Danh sách</button>
          <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('month')}><LayoutGrid size={14} /> Tháng</button>
          <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('week')}>Tuần</button>
          <button className={`btn btn-sm ${view === 'day' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('day')}>Ngày</button>
        </div>
      </div>

      <div className="calendar-layout">
        <div>
          <div className="calendar-header">
            <button className="btn btn-secondary btn-sm" onClick={handlePrev}><ChevronLeft size={14} /> {prevLabel}</button>
            <div style={{ fontWeight: 700 }}>{headerLabel}</div>
            <button className="btn btn-secondary btn-sm" onClick={handleNext}>{nextLabel} <ChevronRight size={14} /></button>
          </div>

          {loading ? <Loading /> : view === 'list' ? (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>NGÀY & GIỜ</th>
                      <th>LỚP</th>
                      <th>GIÁO VIÊN</th>
                      <th>PHÒNG</th>
                      <th>TRẠNG THÁI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.length === 0 ? (
                      <tr><td colSpan={6}><EmptyState message="Không có lịch học" /></td></tr>
                    ) : schedules.map((s) => (
                      <tr key={s.id} style={s.status === 'cancelled' ? { opacity: 0.45 } : {}}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{formatDateOnly(s.session_date)}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</div>
                        </td>
                        <td style={s.status === 'cancelled' ? { textDecoration: 'line-through' } : {}}>{s.class_name}</td>
                        <td>{s.teacher_name || '—'}</td>
                        <td>{s.room_name || '—'}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td><button className="btn btn-secondary btn-sm" onClick={() => setSelectedSchedule(s)}>Xem</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : view === 'week' ? (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: 12, fontWeight: 700 }}>
                Tuần {weekStart.toLocaleDateString('vi-VN')} - {weekEnd.toLocaleDateString('vi-VN')}
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>NGÀY & GIỜ</th>
                      <th>LỚP</th>
                      <th>GIÁO VIÊN</th>
                      <th>PHÒNG</th>
                      <th>TRẠNG THÁI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekSchedules.length === 0 ? (
                      <tr><td colSpan={6}><EmptyState message="Không có lịch trong tuần" /></td></tr>
                    ) : weekSchedules.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{formatDateOnly(s.session_date)}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</div>
                        </td>
                        <td>{s.class_name}</td>
                        <td>{s.teacher_name || '—'}</td>
                        <td>{s.room_name || '—'}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td><button className="btn btn-secondary btn-sm" onClick={() => setSelectedSchedule(s)}>Xem</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : view === 'day' ? (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Ngày</div>
                <input className="form-input" type="date" value={formatDateLocal(selectedDate)} onChange={(e) => setSelectedDate(new Date(e.target.value))} />
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>GIỜ</th>
                      <th>LỚP</th>
                      <th>GIÁO VIÊN</th>
                      <th>PHÒNG</th>
                      <th>TRẠNG THÁI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {daySchedules.length === 0 ? (
                      <tr><td colSpan={6}><EmptyState message="Không có lịch trong ngày" /></td></tr>
                    ) : daySchedules.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</td>
                        <td>{s.class_name}</td>
                        <td>{s.teacher_name || '—'}</td>
                        <td>{s.room_name || '—'}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td><button className="btn btn-secondary btn-sm" onClick={() => setSelectedSchedule(s)}>Xem</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="calendar-grid">
              {['T2','T3','T4','T5','T6','T7','CN'].map((d) => (
                <div key={d} className="calendar-weekday">{d}</div>
              ))}
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={`empty-${idx}`} className="calendar-cell empty" />;
                const key = formatDateLocal(cell);
                const daySchedules = scheduleMap[key] || [];
                return (
                  <div key={key} className={`calendar-cell${key === todayKey ? ' today' : ''}`}>
                    <div className="calendar-date">{cell.getDate()}</div>
                    <div className="calendar-events">
                      {daySchedules.slice(0, 3).map((s) => (
                        <button key={s.id} className="calendar-event" onClick={() => setSelectedSchedule(s)}>
                          <span>{s.start_time?.slice(0,5)} {s.class_name}</span>
                        </button>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="calendar-more">+{daySchedules.length - 3} buổi</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="agenda-panel">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Agenda</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', marginBottom: 6 }}>HÔM NAY</div>
          {agendaToday.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>Không có buổi học</div>
          ) : agendaToday.map((s) => (
            <div key={s.id} className="agenda-item" onClick={() => setSelectedSchedule(s)}>
              <div style={{ fontWeight: 600 }}>{s.class_name}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</div>
            </div>
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', margin: '12px 0 6px' }}>SẮP TỚI</div>
          {agendaUpcoming.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Chưa có lịch</div>
          ) : agendaUpcoming.map((s) => (
            <div key={s.id} className="agenda-item" onClick={() => setSelectedSchedule(s)}>
              <div style={{ fontWeight: 600 }}>{s.class_name}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatDateOnly(s.session_date)} · {s.start_time?.slice(0,5)}</div>
            </div>
          ))}
        </div>
      </div>

      {canManageSchedules && showWizard && (
        <ScheduleWizardModal classes={classes} branches={branches} onClose={() => setShowWizard(false)} onSuccess={load} />
      )}

      {selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          rooms={rooms}
          teachers={teachers}
          canManage={canManageSchedules}
          canTakeAttendance={canTakeAttendance}
          onClose={() => setSelectedSchedule(null)}
          onRefresh={load}
          onAttendance={() => navigate(`${portalBase}/attendance?scheduleId=${selectedSchedule.id}`)}
        />
      )}
    </div>
  );
}
