import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, Calendar, Infinity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { classesApi, branchesApi, usersApi, schedulesApi } from '../../api';
import { StatusBadge, Modal, Loading, EmptyState, ConfirmDialog } from '../../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

const SHOW_BRANCH_UI = false;

const WEEKDAYS = [
  { v: 1, short: 'T2', label: 'Thứ 2' },
  { v: 2, short: 'T3', label: 'Thứ 3' },
  { v: 3, short: 'T4', label: 'Thứ 4' },
  { v: 4, short: 'T5', label: 'Thứ 5' },
  { v: 5, short: 'T6', label: 'Thứ 6' },
  { v: 6, short: 'T7', label: 'Thứ 7' },
  { v: 0, short: 'CN', label: 'Chủ nhật' },
];

function normalizeWeeklySchedules(weekly: any[]) {
  return (weekly || []).map((w) => ({
    weekday: w.weekday,
    startTime: w.start_time || w.startTime || '08:00',
    endTime: w.end_time || w.endTime || '10:00',
    roomId: w.room_id || w.roomId || '',
  }));
}

function parseDateUTC(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateUTC(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

function calculateEndDate(startDate: string, expectedSessions: number, weeklySchedules: any[]) {
  if (!startDate || !expectedSessions || expectedSessions <= 0 || !weeklySchedules.length) return '';
  const countByWeekday = new Map<number, number>();
  weeklySchedules.forEach((w) => {
    const weekday = Number(w.weekday);
    if (Number.isFinite(weekday) && weekday >= 0 && weekday <= 6) {
      countByWeekday.set(weekday, (countByWeekday.get(weekday) || 0) + 1);
    }
  });
  if (!countByWeekday.size) return '';

  const current = parseDateUTC(startDate);
  let counted = 0;
  for (let guard = 0; guard < 3700; guard++) {
    counted += countByWeekday.get(current.getUTCDay()) || 0;
    if (counted >= expectedSessions) return formatDateUTC(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return '';
}

function ClassForm({ initial, branches, teachers, onClose, onSuccess }: { initial?: any; branches: any[]; teachers: any[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    branchId: initial?.branch_id || (branches[0]?.id || ''),
    classType: initial?.class_type || 'fixed',
    maxStudents: initial?.max_students || 20,
    expectedFee: initial?.expected_fee || 0,
    startDate: toDateInputValue(initial?.start_date),
    endDate: toDateInputValue(initial?.end_date),
    expectedSessions: initial?.expected_sessions || 30,
    description: initial?.description || '',
    status: initial?.status || 'upcoming',
  });
  const [weeklySchedules, setWeeklySchedules] = useState<any[]>(normalizeWeeklySchedules(initial?.weekly_schedules || []));
  const [teacherIds, setTeacherIds] = useState<number[]>((initial?.teachers || []).map((t: any) => t.id));
  const [autoGenerateSchedules, setAutoGenerateSchedules] = useState(false);
  const [applySameTime, setApplySameTime] = useState(true);
  const [commonTime, setCommonTime] = useState({ startTime: '08:00', endTime: '10:00' });
  const [rooms, setRooms] = useState<any[]>([]);
  const [autoCode, setAutoCode] = useState('');
  const [loading, setLoading] = useState(false);

  const computedEndDate = useMemo(() => (
    form.classType === 'fixed'
      ? calculateEndDate(form.startDate, Number(form.expectedSessions || 0), weeklySchedules)
      : ''
  ), [form.classType, form.startDate, form.expectedSessions, weeklySchedules]);


  useEffect(() => {
    if (!form.branchId && branches[0]?.id) {
      setForm((f) => ({ ...f, branchId: branches[0].id }));
    }
  }, [branches, form.branchId]);

  useEffect(() => {
    if (initial?.code) setAutoCode(initial.code);
    if (!initial) {
      classesApi.getNextCode().then((res: any) => setAutoCode(res.data.code)).catch(() => {});
    }
  }, [initial]);

  useEffect(() => {
    if (!form.branchId) return;
    branchesApi.getById(Number(form.branchId))
      .then((res) => setRooms(res.data.rooms || []))
      .catch(() => setRooms([]));
  }, [form.branchId]);

  useEffect(() => {
    if (!weeklySchedules.length) return;
    const same = weeklySchedules.every((w) => w.startTime === weeklySchedules[0].startTime && w.endTime === weeklySchedules[0].endTime);
    setApplySameTime(same);
    if (same) setCommonTime({ startTime: weeklySchedules[0].startTime, endTime: weeklySchedules[0].endTime });
  }, [initial]);

  const toggleWeekday = (weekday: number) => {
    setWeeklySchedules((prev) => {
      const exists = prev.find((w) => w.weekday === weekday);
      if (exists) return prev.filter((w) => w.weekday !== weekday);
      return [...prev, { weekday, startTime: commonTime.startTime, endTime: commonTime.endTime, roomId: rooms[0]?.id || '' }].sort((a, b) => a.weekday - b.weekday);
    });
  };

  const updateWeekly = (weekday: number, field: string, value: any) => {
    setWeeklySchedules((prev) => prev.map((w) => (w.weekday === weekday ? { ...w, [field]: value } : w)));
  };

  const handleCommonTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    setCommonTime((t) => ({ ...t, [field]: value }));
    if (!applySameTime) return;
    setWeeklySchedules((prev) => prev.map((w) => ({ ...w, [field]: value })));
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Vui lòng nhập tên lớp'); return; }
    if (form.classType === 'fixed' && !form.startDate) { toast.error('Vui lòng nhập ngày bắt đầu'); return; }
    if (form.classType === 'fixed' && (!form.expectedSessions || Number(form.expectedSessions) <= 0)) { toast.error('Vui lòng nhập số buổi lớn hơn 0'); return; }
    if (form.classType === 'fixed' && weeklySchedules.length === 0) { toast.error('Vui lòng chọn ít nhất một thứ học trong tuần'); return; }
    if (form.classType === 'fixed' && !computedEndDate) { toast.error('Chưa thể tự tính ngày kết thúc. Vui lòng kiểm tra ngày bắt đầu, số buổi và thứ học.'); return; }
    if (!teacherIds.length) { toast.error('Vui lòng chọn giáo viên phụ trách'); return; }
    for (const w of weeklySchedules) {
      if (w.startTime >= w.endTime) { toast.error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc trong lịch tuần'); return; }
    }
    if (autoGenerateSchedules && (!form.startDate || !computedEndDate || weeklySchedules.length === 0)) {
      toast.error('Muốn tự tạo lịch thật thì cần ngày bắt đầu, số buổi và lịch tuần mẫu');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        endDate: form.classType === 'fixed' ? computedEndDate : '',
        expectedSessions: form.classType === 'fixed' ? form.expectedSessions : null,
        teacherIds,
        weeklySchedules: weeklySchedules.map((w) => ({
          weekday: w.weekday,
          startTime: w.startTime,
          endTime: w.endTime,
          roomId: w.roomId || null,
        })),
      };
      if (initial) {
        await classesApi.update(initial.id, payload);
        toast.success('Cập nhật thành công');
      } else {
        const res = await classesApi.create(payload);
        if (autoGenerateSchedules) {
          await schedulesApi.generate(res.data.id, {
            fromDate: form.startDate,
            toDate: computedEndDate,
            useWeeklyTemplate: true,
          });
          toast.success('Tạo lớp và tạo lịch học thành công');
        } else {
          toast.success('Tạo lớp thành công');
        }
      }
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={initial ? 'Sửa lớp học' : 'Thêm lớp học mới'} onClose={onClose} size="lg"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? '...' : initial ? 'Cập nhật' : 'Thêm mới'}</button></>}>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Mã lớp</label>
          <input className="form-input" value={autoCode || 'Đang tạo mã...'} disabled />
          <div className="form-hint">Mã lớp được tạo tự động</div>
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tên lớp <span className="required">*</span></label>
          <input className="form-input" placeholder="VD: Tiếng Anh Giao Tiếp Cơ Bản" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        {SHOW_BRANCH_UI && (
          <div className="form-group">
            <label className="form-label">Cơ sở <span className="required">*</span></label>
            <select className="form-select" value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: parseInt(e.target.value) }))}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Giáo viên phụ trách <span className="required">*</span></label>
          <select className="form-select" value={teacherIds[0] || ''} onChange={e => setTeacherIds(e.target.value ? [parseInt(e.target.value)] : [])}>
            <option value="">-- Chọn giáo viên chính --</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <div className="form-hint">Giáo viên này sẽ được dùng mặc định khi sinh lịch học thật.</div>
        </div>
        <div className="form-group">
          <label className="form-label">Loại lớp <span className="required">*</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" onClick={() => setForm(f => ({ ...f, classType: 'fixed' }))}
              style={{ border: `1.5px solid ${form.classType === 'fixed' ? 'var(--primary)' : 'var(--gray-200)'}`, background: form.classType === 'fixed' ? 'var(--primary-50)' : 'white', borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: form.classType === 'fixed' ? 'var(--primary)' : 'var(--gray-700)' }}>
                <Calendar size={16} /> Có thời hạn
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>Có ngày bắt đầu & kết thúc</div>
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, classType: 'open' }))}
              style={{ border: `1.5px solid ${form.classType === 'open' ? 'var(--primary)' : 'var(--gray-200)'}`, background: form.classType === 'open' ? 'var(--primary-50)' : 'white', borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: form.classType === 'open' ? 'var(--primary)' : 'var(--gray-700)' }}>
                <Infinity size={16} /> Không thời hạn
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>Học viên tham gia linh hoạt</div>
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Sĩ số tối đa</label>
          <input className="form-input" type="number" min={1} value={form.maxStudents} onChange={e => setForm(f => ({ ...f, maxStudents: parseInt(e.target.value) }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Ngày bắt đầu {form.classType === 'fixed' && <span className="required">*</span>}</label>
          <input className="form-input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        {form.classType === 'fixed' && <>
          <div className="form-group">
            <label className="form-label">Số buổi dự kiến <span className="required">*</span></label>
            <input className="form-input" type="number" min={1} value={form.expectedSessions} onChange={e => setForm(f => ({ ...f, expectedSessions: parseInt(e.target.value) || 0 }))} />
            <div className="form-hint">Hệ thống sẽ dùng số buổi + các thứ học trong tuần để tự tính ngày kết thúc.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Ngày kết thúc tự động</label>
            <input className="form-input" type="date" value={computedEndDate} disabled />
            <div className="form-hint">Ngày kết thúc là ngày của buổi học cuối cùng.</div>
          </div>
        </>}
        <div className="form-group">
          <label className="form-label">Trạng thái</label>
          <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="upcoming">Sắp khai giảng</option>
            <option value="active">Đang hoạt động</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="cancelled">Đã huỷ</option>
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Lịch học trong tuần {form.classType === 'fixed' && <span className="required">*</span>}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {WEEKDAYS.map(d => (
              <button key={d.v} type="button" onClick={() => toggleWeekday(d.v)}
                style={{
                  padding: '6px 10px', borderRadius: 8,
                  border: `1.5px solid ${weeklySchedules.find(w => w.weekday === d.v) ? 'var(--primary)' : 'var(--gray-200)'}`,
                  background: weeklySchedules.find(w => w.weekday === d.v) ? 'var(--primary)' : 'white',
                  color: weeklySchedules.find(w => w.weekday === d.v) ? 'white' : 'var(--gray-600)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)'
                }}>{d.short}</button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}>
            <input type="checkbox" checked={applySameTime} onChange={(e) => {
              setApplySameTime(e.target.checked);
              if (e.target.checked) {
                setWeeklySchedules((prev) => prev.map((w) => ({ ...w, startTime: commonTime.startTime, endTime: commonTime.endTime })));
              }
            }} />
            Áp dụng cùng giờ cho tất cả các ngày
          </label>
          {applySameTime && (
            <div style={{ background: 'var(--primary-50)', padding: 12, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>Giờ học chung cho tất cả các ngày</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div className="form-label">Bắt đầu</div>
                  <input className="form-input" type="time" value={commonTime.startTime} onChange={(e) => handleCommonTimeChange('startTime', e.target.value)} />
                </div>
                <div>
                  <div className="form-label">Kết thúc</div>
                  <input className="form-input" type="time" value={commonTime.endTime} onChange={(e) => handleCommonTimeChange('endTime', e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {weeklySchedules.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Chọn các ngày học trong tuần để tiếp tục thiết lập lịch học</div>
          )}
          {weeklySchedules.map((w) => {
            const label = WEEKDAYS.find(d => d.v === w.weekday)?.label || '';
            return (
              <div key={w.weekday} style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div className="form-label">Giờ bắt đầu</div>
                    <input className="form-input" type="time" value={w.startTime}
                      onChange={(e) => updateWeekly(w.weekday, 'startTime', e.target.value)} disabled={applySameTime} />
                  </div>
                  <div>
                    <div className="form-label">Giờ kết thúc</div>
                    <input className="form-input" type="time" value={w.endTime}
                      onChange={(e) => updateWeekly(w.weekday, 'endTime', e.target.value)} disabled={applySameTime} />
                  </div>
                  <div>
                    <div className="form-label">Phòng học</div>
                    <select className="form-select" value={w.roomId || ''} onChange={(e) => updateWeekly(w.weekday, 'roomId', e.target.value ? parseInt(e.target.value) : '')}>
                      <option value="">-- Không chọn --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.capacity || 0} chỗ)</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!initial && form.classType === 'fixed' && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={autoGenerateSchedules} onChange={(e) => setAutoGenerateSchedules(e.target.checked)} />
              Tạo lịch học thật ngay sau khi lưu lớp
            </label>
            <div className="form-hint">Hệ thống sẽ tự tính ngày kết thúc từ số buổi và sinh các buổi học theo lịch tuần mẫu, đồng thời kiểm tra trùng lớp/phòng/giáo viên.</div>
          </div>
        )}
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Mô tả</label>
          <textarea className="form-textarea" placeholder="Mô tả lớp học..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStudent = user?.roles?.includes('student') ?? false;
  const isTeacher = user?.roles?.includes('teacher') ?? false;
  const canManageClasses = user?.roles?.some((role) => ['admin', 'staff'].includes(role)) ?? false;
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;
  const classDetailBase = isStudent || isTeacher ? `${portalBase}/my-classes` : `${portalBase}/classes`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const clsRes = await classesApi.getAll({
        search,
        branchId: undefined,
        type: typeFilter,
        status: statusFilter,
      });
      setClasses(clsRes.data.classes || []);
      setTotal(clsRes.data.total || 0);

      if (!isStudent) {
        const brRes = await branchesApi.getAll({ limit: 100 });
        setBranches(brRes.data.branches || []);
      } else {
        setBranches([]);
      }

      if (canManageClasses) {
        const teacherRes = await usersApi.getAll({ role: 'teacher', limit: 200 });
        setTeachers(teacherRes.data.users || []);
      } else {
        setTeachers([]);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tải danh sách lớp học');
    } finally { setLoading(false); }
  }, [search, branchFilter, typeFilter, statusFilter, isStudent, canManageClasses]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try { await classesApi.delete(deleting.id); toast.success('Đã xoá lớp học'); setDeleting(null); load(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Không thể xoá'); }
  };

  const handleEdit = async (cls: any) => {
    setEditingLoading(true);
    try {
      const res = await classesApi.getById(cls.id);
      setEditing(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tải dữ liệu lớp');
    } finally {
      setEditingLoading(false);
    }
  };

  const activeCount = classes.filter(c => c.status === 'active').length;
  const totalStudents = classes.reduce((s: number, c: any) => s + parseInt(c.student_count || 0), 0);
  const totalTeachers = classes.reduce((sum: number, c: any) => sum + parseInt(c.teacher_count || 0), 0);

  const pageTitle = isStudent ? 'Lớp học của tôi' : isTeacher ? 'Lớp giảng dạy của tôi' : 'Quản lý Lớp học';
  const pageSubtitle = isStudent
    ? 'Xem các lớp học bạn đang tham gia'
    : isTeacher
      ? 'Xem các lớp bạn được phân công giảng dạy'
      : 'Quản lý danh sách các lớp học';

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>
        {canManageClasses && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Thêm Lớp học</button>
        )}
      </div>

      {/* Stats */}
      {!isStudent && !isTeacher && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'TỔNG LỚP HỌC', value: total, color: '#2563eb', bg: '#eff6ff' },
            { label: 'ĐANG HOẠT ĐỘNG', value: activeCount, color: '#10b981', bg: '#ecfdf5' },
            { label: 'TỔNG HỌC VIÊN', value: totalStudents, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'GIÁO VIÊN', value: totalTeachers, color: '#f97316', bg: '#fff7ed' },
          ].map(c => (
            <div key={c.label} className="stat-card">
              <div style={{ flex: 1 }}>
                <div className="stat-value">{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
              <div className="stat-icon" style={{ background: c.bg, width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {c.label.includes('LỚP') ? '📚' : c.label.includes('HỌC VIÊN') ? '🎓' : c.label.includes('GIÁO') ? '👨‍🏫' : '✅'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Tìm theo tên lớp, mã lớp..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {!isStudent && SHOW_BRANCH_UI && (
          <select className="form-select" style={{ width: 150 }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="">Cơ sở: Tất cả</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className="form-select" style={{ width: 150 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Loại lớp: Tất cả</option>
          <option value="fixed">Có thời hạn</option>
          <option value="open">Không thời hạn</option>
        </select>
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="upcoming">Sắp khai giảng</option>
          <option value="active">Đang hoạt động</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã huỷ</option>
        </select>
      </div>

      {loading ? <Loading /> : (
        <>
          <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--gray-400)' }}>Hiển thị {classes.length} / {total} lớp học</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {classes.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Chưa có lớp học nào" /></div>
              : classes.map(cls => {
                const progress = cls.expected_sessions ? Math.round((cls.completed_sessions / cls.expected_sessions) * 100) : 0;
                return (
                  <div key={cls.id} className="class-card" style={{ borderLeft: `3px solid ${cls.status === 'active' ? 'var(--primary)' : cls.status === 'upcoming' ? 'var(--warning)' : 'var(--gray-200)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <StatusBadge status={cls.status} />
                      <span style={{ fontSize: 11, background: cls.class_type === 'fixed' ? 'var(--primary-50)' : 'var(--purple-light)', color: cls.class_type === 'fixed' ? 'var(--primary)' : 'var(--purple)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        {cls.class_type === 'fixed' ? 'Có thời hạn' : 'Không thời hạn'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--gray-900)' }}>{cls.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 10 }}>{cls.code} · {cls.branch_name}</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        👨‍🏫 <strong>{cls.teacher_count}</strong> <span style={{ color: 'var(--gray-400)' }}>Giáo viên</span>
                      </span>
                      {!isStudent && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          🎓 <strong>{cls.student_count}/{cls.max_students}</strong> <span style={{ color: 'var(--gray-400)' }}>Học viên</span>
                        </span>
                      )}
                    </div>

                    {cls.expected_sessions && (
                      <>
                        <div className="class-progress">
                          <div className="class-progress-bar" style={{ width: `${progress}%` }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 600, textAlign: 'right' }}>
                          Tiến độ {cls.completed_sessions}/{cls.expected_sessions} buổi
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`${classDetailBase}/${cls.id}`)}>
                        <Eye size={12} /> Xem
                      </button>
                      {canManageClasses && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(cls)} disabled={editingLoading}>
                            <Pencil size={12} /> Sửa
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleting(cls)}>
                            <Trash2 size={12} /> Xoá
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {canManageClasses && showAdd && <ClassForm branches={branches} teachers={teachers} onClose={() => setShowAdd(false)} onSuccess={load} />}
      {canManageClasses && editing && <ClassForm initial={editing} branches={branches} teachers={teachers} onClose={() => setEditing(null)} onSuccess={load} />}
      {canManageClasses && deleting && <ConfirmDialog message={`Xoá lớp "${deleting.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  );
}
