import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usersApi, branchesApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, StatusBadge, Loading, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';
import { EditUserModal } from './UsersPage';

const SHOW_BRANCH_UI = true;

function UserActionButtons({ user, detailPath, onEdit, onDeleted }: { user: any; detailPath: string; onEdit: () => void; onDeleted: () => void }) {
  const { user: currentUser, hasRole } = useAuth();
  const navigate = useNavigate();
  const isSelf = Number(currentUser?.id) === Number(user.id);
  const canDelete = hasRole('admin') && !isSelf;

  const handleDelete = async () => {
    const ok = window.confirm(`Bạn có chắc muốn xoá tài khoản "${user.full_name}"? Thao tác này sẽ xoá cả vai trò và hồ sơ liên quan.`);
    if (!ok) return;
    try {
      await usersApi.delete(user.id);
      toast.success('Đã xoá tài khoản');
      onDeleted();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không xoá được tài khoản');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button title="Xem chi tiết" className="btn btn-secondary btn-sm" onClick={() => navigate(detailPath)}><Eye size={14} /></button>
      <button title="Sửa tài khoản" className="btn btn-secondary btn-sm" onClick={onEdit}><Edit2 size={14} /></button>
      <button title={isSelf ? 'Không thể tự xoá tài khoản đang đăng nhập' : (!hasRole('admin') ? 'Chỉ admin được xoá tài khoản' : 'Xoá tài khoản')} className="btn btn-danger btn-sm" disabled={!canDelete} onClick={handleDelete}><Trash2 size={14} /></button>
    </div>
  );
}

export function TeachersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, brRes] = await Promise.all([
        usersApi.getAll({ role: 'teacher', search, status: statusFilter, branchId: SHOW_BRANCH_UI ? branchFilter : undefined }),
        branchesApi.getAll({ limit: 200 }),
      ]);
      setUsers(res.data.users);
      setBranches(brRes.data.branches || []);
    } catch {} finally { setLoading(false); }
  }, [search, statusFilter, branchFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý Giáo viên</h1>
          <p className="page-subtitle">Quản lý danh sách giáo viên</p>
        </div>
      </div>
      <div className="filter-bar">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Tìm theo họ tên, mã GV, SĐT, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {SHOW_BRANCH_UI && (
          <select className="form-select" style={{ width: 160 }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="">Cơ sở: Tất cả</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loading /> : (
          <div className="table-container">
            <table>
              <thead><tr><th>HỌ VÀ TÊN</th><th>CHUYÊN MÔN</th><th>SĐT</th><th>EMAIL</th><th>NGÀY VÀO LÀM</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
              <tbody>
                {users.length === 0 ? <tr><td colSpan={7}><EmptyState /></td></tr>
                  : users.map(u => (
                    <tr key={u.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={u.full_name} size={32} /><div style={{ fontWeight: 600 }}>{u.full_name}</div></div></td>
                      <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{u.specialization || '—'}</td>
                      <td>{u.phone || '—'}</td>
                      <td>{u.email || '—'}</td>
                      <td>{u.teacher_start_date ? new Date(u.teacher_start_date).toLocaleDateString('vi-VN') : '—'}</td>
                      <td><StatusBadge status={u.study_status || (u.is_active ? 'active' : 'inactive')} /></td>
                      <td><UserActionButtons user={u} detailPath={`${portalBase}/teachers/${u.id}`} onEdit={() => setEditingUserId(u.id)} onDeleted={load} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editingUserId && <EditUserModal userId={editingUserId} onClose={() => setEditingUserId(null)} onSuccess={load} />}
    </div>
  );
}

export function StaffPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, brRes] = await Promise.all([
        usersApi.getAll({ role: 'staff', search, status: statusFilter, branchId: SHOW_BRANCH_UI ? branchFilter : undefined }),
        branchesApi.getAll({ limit: 200 }),
      ]);
      setUsers(res.data.users);
      setBranches(brRes.data.branches || []);
    } catch {} finally { setLoading(false); }
  }, [search, statusFilter, branchFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Quản lý Nhân viên</h1><p className="page-subtitle">Quản lý danh sách nhân viên</p></div>
      <div className="filter-bar">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Tìm theo họ tên, mã NV, SĐT, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {SHOW_BRANCH_UI && (
          <select className="form-select" style={{ width: 160 }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="">Cơ sở: Tất cả</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loading /> : (
          <div className="table-container">
            <table>
              <thead><tr><th>HỌ VÀ TÊN</th><th>VỊ TRÍ</th><th>SĐT</th><th>EMAIL</th><th>NGÀY VÀO LÀM</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
              <tbody>
                {users.length === 0 ? <tr><td colSpan={7}><EmptyState /></td></tr>
                  : users.map(u => (
                    <tr key={u.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={u.full_name} size={32} /><div style={{ fontWeight: 600 }}>{u.full_name}</div></div></td>
                      <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{u.position || '—'}</td>
                      <td>{u.phone || '—'}</td>
                      <td>{u.email || '—'}</td>
                      <td>{u.staff_start_date ? new Date(u.staff_start_date).toLocaleDateString('vi-VN') : '—'}</td>
                      <td><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                      <td><UserActionButtons user={u} detailPath={`${portalBase}/staff/${u.id}`} onEdit={() => setEditingUserId(u.id)} onDeleted={load} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editingUserId && <EditUserModal userId={editingUserId} onClose={() => setEditingUserId(null)} onSuccess={load} />}
    </div>
  );
}

export function StudentsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll({ role: 'student', search, status: statusFilter });
      setUsers(res.data.users);
    } catch {} finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý Học viên</h1>
          <p className="page-subtitle">Quản lý danh sách học viên</p>
        </div>
        <button className="btn btn-secondary">Import Excel</button>
      </div>
      <div className="filter-bar">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Tìm theo họ tên, mã HV, SĐT, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="active">Đang học</option>
          <option value="inactive">Ngưng học</option>
        </select>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loading /> : (
          <div className="table-container">
            <table>
              <thead><tr><th>HỌ VÀ TÊN</th><th>EMAIL</th><th>SĐT</th><th>NGÀY NHẬP HỌC</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
              <tbody>
                {users.length === 0 ? <tr><td colSpan={6}><EmptyState /></td></tr>
                  : users.map(u => (
                    <tr key={u.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={u.full_name} size={32} /><div style={{ fontWeight: 600 }}>{u.full_name}</div></div></td>
                      <td>{u.email || '—'}</td>
                      <td>{u.phone || '—'}</td>
                      <td>{u.enrollment_date ? new Date(u.enrollment_date).toLocaleDateString('vi-VN') : '—'}</td>
                      <td><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                      <td><UserActionButtons user={u} detailPath={`${portalBase}/students/${u.id}`} onEdit={() => setEditingUserId(u.id)} onDeleted={load} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editingUserId && <EditUserModal userId={editingUserId} onClose={() => setEditingUserId(null)} onSuccess={load} />}
    </div>
  );
}
