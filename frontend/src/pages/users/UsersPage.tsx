import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, MoreVertical, Download } from 'lucide-react';
import { usersApi, branchesApi } from '../../api';
import { Avatar, StatusBadge, Modal, Loading, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', teacher: 'GV', student: 'HV', staff: 'NV' };
const ROLE_COLORS: Record<string, string> = { admin: 'blue', teacher: 'blue', student: 'green', staff: 'orange' };
const SHOW_BRANCH_UI = false;

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] || 'gray';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: `var(--${color === 'orange' ? 'orange' : color}-light, var(--gray-100))`,
      color: `var(--${color === 'orange' ? 'orange' : color === 'blue' ? 'primary' : color === 'green' ? 'success' : 'gray-600'})`
    }}>
      {role === 'teacher' ? '📚' : role === 'student' ? '🎓' : role === 'staff' ? '💼' : '🔐'} {ROLE_LABELS[role] || role}
    </span>
  );
}

// ---- ADD USER MODAL ----
function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [tab, setTab] = useState<'info' | 'role' | 'password'>('info');
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', gender: 'male', dateOfBirth: '', address: '',
    password: '', roles: [] as string[],
    teacherInfo: { specialization: '', qualifications: '', startDate: '', bankAccount: '', notes: '' },
    studentInfo: { enrollmentDate: '', notes: '' },
    staffInfo: { position: '', branchId: '', startDate: '', bankAccount: '', notes: '' },
  });
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    branchesApi.getAll({ limit: 200 }).then((r) => setBranches(r.data.branches || [])).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (!form.staffInfo.branchId && branches[0]?.id) {
      setForm((f) => ({ ...f, staffInfo: { ...f.staffInfo, branchId: String(branches[0].id) } }));
    }
  }, [branches, form.staffInfo.branchId]);

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role]
    }));
  };

  const handleSubmit = async () => {
    if (!form.fullName) { toast.error('Vui lòng nhập họ tên'); return; }
    if (form.roles.length === 0) { toast.error('Vui lòng chọn ít nhất một vai trò'); return; }
    setLoading(true);
    try {
      await usersApi.create({
        ...form,
        password: form.password || 'Default@123',
      });
      toast.success('Tạo tài khoản thành công');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const ROLE_OPTIONS = [
    { id: 'teacher', label: 'Giáo viên', icon: '📚', color: 'var(--primary)' },
    { id: 'student', label: 'Học viên', icon: '🎓', color: 'var(--success)' },
    { id: 'staff', label: 'Nhân viên', icon: '💼', color: 'var(--orange)' },
    { id: 'admin', label: 'Admin', icon: '🔐', color: 'var(--purple)' },
  ];

  return (
    <Modal title="Thêm tài khoản mới" onClose={onClose} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Đang thêm...' : 'Thêm mới'}
        </button>
      </>}
    >
      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-100)', paddingBottom: 0 }}>
        {[
          { id: 'info', label: 'Thông tin' },
          { id: 'role', label: 'Vai trò' },
          { id: 'password', label: 'Bảo mật' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
              color: tab === t.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -2,
            }}>{t.label}</button>
        ))}
      </div>

      {tab === 'info' && (
        <div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Họ và tên <span className="required">*</span></label>
              <input className="form-input" placeholder="Nguyễn Văn A" value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email <span className="required">*</span></label>
              <input className="form-input" type="email" placeholder="email@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Số điện thoại <span className="required">*</span></label>
              <input className="form-input" placeholder="09x xxx xxxx" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ngày sinh <span className="required">*</span></label>
              <input className="form-input" type="date" value={form.dateOfBirth}
                onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Giới tính</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['male', 'female', 'other'].map(g => (
                <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: g }))}
                  style={{
                    padding: '7px 18px', borderRadius: 8,
                    border: `1.5px solid ${form.gender === g ? 'var(--primary)' : 'var(--gray-200)'}`,
                    background: form.gender === g ? 'var(--primary-50)' : 'white',
                    color: form.gender === g ? 'var(--primary)' : 'var(--gray-600)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)'
                  }}>
                  {g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : 'Khác'}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Địa chỉ</label>
            <input className="form-input" placeholder="Địa chỉ..." value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
        </div>
      )}

      {tab === 'role' && (
        <div>
          <div className="form-label" style={{ marginBottom: 10 }}>Vai trò <span className="required">*</span></div>
          <div className="role-grid">
            {ROLE_OPTIONS.map(opt => {
              const sel = form.roles.includes(opt.id);
              return (
                <div key={opt.id} className={`role-card${sel ? ' selected' : ''}`}
                  style={{ borderColor: sel ? opt.color : undefined, background: sel ? opt.color + '15' : undefined }}
                  onClick={() => toggleRole(opt.id)}>
                  {sel && <div className="check-mark" style={{ background: opt.color }}>✓</div>}
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{opt.icon}</div>
                  <div className="role-name">{opt.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>Có thể chọn nhiều vai trò</div>

          {form.roles.includes('teacher') && (
            <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--primary)' }}>📚 Thông tin giáo viên</div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Chuyên môn</label>
                  <input className="form-input" placeholder="VD: Tiếng Anh, Toán, Lý..."
                    value={form.teacherInfo.specialization}
                    onChange={e => setForm(f => ({ ...f, teacherInfo: { ...f.teacherInfo, specialization: e.target.value } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ngày vào làm</label>
                  <input className="form-input" type="date" value={form.teacherInfo.startDate}
                    onChange={e => setForm(f => ({ ...f, teacherInfo: { ...f.teacherInfo, startDate: e.target.value } }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Bằng cấp / Chứng chỉ</label>
                  <textarea className="form-textarea" placeholder="VD: Cử nhân Sư phạm, IELTS 8.0, TKT..."
                    value={form.teacherInfo.qualifications}
                    onChange={e => setForm(f => ({ ...f, teacherInfo: { ...f.teacherInfo, qualifications: e.target.value } }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Số tài khoản ngân hàng</label>
                  <input className="form-input" placeholder="VD: 1234567890 - Vietcombank"
                    value={form.teacherInfo.bankAccount}
                    onChange={e => setForm(f => ({ ...f, teacherInfo: { ...f.teacherInfo, bankAccount: e.target.value } }))} />
                </div>
              </div>
            </div>
          )}

          {form.roles.includes('student') && (
            <div style={{ background: 'var(--success-light)', border: '1px solid #d1fae5', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--success)' }}>🎓 Thông tin học viên</div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Ngày nhập học</label>
                  <input className="form-input" type="date" value={form.studentInfo.enrollmentDate}
                    onChange={e => setForm(f => ({ ...f, studentInfo: { ...f.studentInfo, enrollmentDate: e.target.value } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <input className="form-input" placeholder="Ghi chú thêm về học viên..."
                    value={form.studentInfo.notes}
                    onChange={e => setForm(f => ({ ...f, studentInfo: { ...f.studentInfo, notes: e.target.value } }))} />
                </div>
              </div>
            </div>
          )}

          {form.roles.includes('staff') && (
            <div style={{ background: 'var(--orange-light)', border: '1px solid #fed7aa', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--orange)' }}>💼 Thông tin nhân viên</div>
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Vị trí <span className="required">*</span></label>
                  <input className="form-input" placeholder="VD: Lễ tân, Kế toán, Quản lý..."
                    value={form.staffInfo.position}
                    onChange={e => setForm(f => ({ ...f, staffInfo: { ...f.staffInfo, position: e.target.value } }))} />
                </div>
                {SHOW_BRANCH_UI && (
                  <div className="form-group">
                    <label className="form-label">Cơ sở</label>
                    <select className="form-select" value={form.staffInfo.branchId} onChange={e => setForm(f => ({ ...f, staffInfo: { ...f.staffInfo, branchId: e.target.value } }))}>
                      <option value="">-- Chọn cơ sở --</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Ngày vào làm</label>
                  <input className="form-input" type="date" value={form.staffInfo.startDate}
                    onChange={e => setForm(f => ({ ...f, staffInfo: { ...f.staffInfo, startDate: e.target.value } }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Số tài khoản ngân hàng</label>
                  <input className="form-input" placeholder="VD: 1234567890 - Vietcombank"
                    value={form.staffInfo.bankAccount}
                    onChange={e => setForm(f => ({ ...f, staffInfo: { ...f.staffInfo, bankAccount: e.target.value } }))} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'password' && (
        <div>
          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input className="form-input" type="password" placeholder="Để trống sẽ dùng Default@123"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <div className="form-hint">Mật khẩu mặc định: Default@123</div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---- MAIN PAGE ----
export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll({ search, role: roleFilter, status: statusFilter });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch {} finally { setLoading(false); }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý Tài khoản</h1>
          <p className="page-subtitle">Quản lý tất cả tài khoản người dùng trong hệ thống</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Thêm tài khoản
        </button>
      </div>

      {/* Stats */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>TỔNG TÀI KHOẢN</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>{total}</div>
        </div>
        <button className="btn btn-secondary btn-sm"><Download size={13} /></button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-input" style={{ flex: 1, position: 'relative' }}>
          <Search size={14} className="search-icon" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Tìm kiếm theo tên, username, email, SĐT"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 140 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Vai trò: Tất cả</option>
          <option value="admin">Admin</option>
          <option value="teacher">Giáo viên</option>
          <option value="student">Học viên</option>
          <option value="staff">Nhân viên</option>
        </select>
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loading /> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>NGƯỜI DÙNG ▲</th>
                  <th>LIÊN HỆ</th>
                  <th>VAI TRÒ</th>
                  <th>MÃ</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState /></td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={u.full_name} size={36} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{u.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.phone}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(u.roles || []).map((r: string) => <RoleBadge key={r} role={r} />)}
                        {(!u.roles || u.roles.length === 0) && <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--gray-500)' }}>
                        {u.student_code || u.teacher_code || u.staff_code || '—'}
                      </span>
                    </td>
                    <td><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                    <td>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4 }}>
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSuccess={loadUsers} />}
    </div>
  );
}
