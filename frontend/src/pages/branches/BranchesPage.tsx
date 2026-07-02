import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, Building2, DoorOpen, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { branchesApi } from '../../api';
import { StatusBadge, Modal, Loading, EmptyState, ConfirmDialog } from '../../components/common';
import toast from 'react-hot-toast';

function BranchForm({ initial, onClose, onSuccess }: { initial?: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: initial?.name || '', code: initial?.code || '', address: initial?.address || '', phone: initial?.phone || '', status: initial?.status || 'active' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Vui lòng nhập tên cơ sở'); return; }
    setLoading(true);
    try {
      if (initial) { await branchesApi.update(initial.id, form); toast.success('Cập nhật thành công'); }
      else { await branchesApi.create(form); toast.success('Tạo cơ sở thành công'); }
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={initial ? 'Sửa cơ sở' : 'Thêm cơ sở mới'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? '...' : initial ? 'Cập nhật' : 'Thêm mới'}</button></>}>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tên cơ sở <span className="required">*</span></label>
          <input className="form-input" placeholder="VD: Chi nhánh Thủ Đức" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Mã cơ sở</label>
          <input className="form-input" placeholder="VD: CS1" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Số điện thoại</label>
          <input className="form-input" placeholder="028 xxxx xxxx" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Địa chỉ</label>
          <input className="form-input" placeholder="Địa chỉ cơ sở..." value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        {initial && (
          <div className="form-group">
            <label className="form-label">Trạng thái</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Không hoạt động</option>
              <option value="maintenance">Đang bảo trì</option>
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await branchesApi.getAll({ search, status: statusFilter });
      setBranches(res.data.branches);
      setTotal(res.data.total);
    } catch {} finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await branchesApi.delete(deleting.id);
      toast.success('Đã xoá cơ sở');
      setDeleting(null); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Không thể xoá'); }
  };

  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý Cơ sở</h1>
          <p className="page-subtitle">Quản lý các chi nhánh và phòng học của trung tâm</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Thêm cơ sở</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'TỔNG CƠ SỞ', value: total, color: '#2563eb', bg: '#eff6ff', icon: Building2 },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ flex: 1 }}><div className="stat-value">{c.value}</div><div className="stat-label">{c.label}</div></div>
            <div className="stat-icon" style={{ background: c.bg }}><c.icon size={20} color={c.color} /></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Tìm theo tên, mã, địa chỉ..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Không hoạt động</option>
          <option value="maintenance">Bảo trì</option>
        </select>
      </div>

      {loading ? <Loading /> : (
        <>
          <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--gray-400)' }}>Hiển thị {branches.length} / {total} cơ sở</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {branches.length === 0 ? <div style={{ gridColumn: '1/-1' }}><EmptyState /></div> : branches.map(b => (
              <div key={b.id} className="card" style={{ padding: 16, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, background: 'var(--primary-50)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} color="var(--primary)" />
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{b.name}</div>
                {b.address && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  📍 {b.address}
                </div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>SỐ PHÒNG</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <DoorOpen size={14} color="var(--primary)" />
                      <span style={{ fontWeight: 700 }}>{b.room_count}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>SỨC CHỨA</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Users size={14} color="var(--orange)" />
                      <span style={{ fontWeight: 700 }}>{b.total_capacity}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`${portalBase}/branches/${b.id}`)}>
                    <Eye size={12} /> Xem
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(b)}>
                    <Pencil size={12} /> Sửa
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleting(b)}>
                    <Trash2 size={12} /> Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showAdd && <BranchForm onClose={() => setShowAdd(false)} onSuccess={load} />}
      {editing && <BranchForm initial={editing} onClose={() => setEditing(null)} onSuccess={load} />}
      {deleting && <ConfirmDialog message={`Bạn có chắc muốn xoá cơ sở "${deleting.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  );
}
