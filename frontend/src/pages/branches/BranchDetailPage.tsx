import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, DoorOpen } from 'lucide-react';
import { branchesApi } from '../../api';
import { StatusBadge, Modal, Loading, ConfirmDialog } from '../../components/common';
import toast from 'react-hot-toast';

function RoomForm({ branchId, initial, onClose, onSuccess }: { branchId: number; initial?: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: initial?.name || '', code: initial?.code || '', capacity: initial?.capacity || 30, status: initial?.status || 'active' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Vui lòng nhập tên phòng'); return; }
    setLoading(true);
    try {
      if (initial) { await branchesApi.updateRoom(branchId, initial.id, form); toast.success('Cập nhật phòng thành công'); }
      else { await branchesApi.addRoom(branchId, form); toast.success('Thêm phòng thành công'); }
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={initial ? 'Sửa phòng học' : 'Thêm phòng học'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? '...' : 'Lưu'}</button></>}>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tên phòng <span className="required">*</span></label>
          <input className="form-input" placeholder="VD: Phòng A3" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Mã phòng</label>
          <input className="form-input" placeholder="VD: A3-CODE" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Sức chứa (chỗ)</label>
          <input className="form-input" type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) }))} />
        </div>
        {initial && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Trạng thái</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Đang hoạt động</option>
              <option value="maintenance">Đang bảo trì</option>
              <option value="inactive">Không hoạt động</option>
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [deletingRoom, setDeletingRoom] = useState<any>(null);
  const [roomFilter, setRoomFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try { const res = await branchesApi.getById(parseInt(id!)); setBranch(res.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleDeleteRoom = async () => {
    try {
      await branchesApi.deleteRoom(parseInt(id!), deletingRoom.id);
      toast.success('Đã xoá phòng'); setDeletingRoom(null); load();
    } catch { toast.error('Không thể xoá phòng này'); }
  };

  if (loading) return <Loading />;
  if (!branch) return <div>Không tìm thấy cơ sở</div>;

  const filteredRooms = (branch.rooms || []).filter((r: any) => roomFilter === 'all' || r.status === roomFilter);
  const activeRooms = (branch.rooms || []).filter((r: any) => r.status === 'active').length;
  const maintenanceRooms = (branch.rooms || []).filter((r: any) => r.status === 'maintenance').length;
  const totalCapacity = (branch.rooms || []).reduce((s: number, r: any) => s + (r.capacity || 0), 0);

  return (
    <div>
      {/* Back */}
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate(`${portalBase}/branches`)}>
        <ArrowLeft size={14} /> Quay lại danh sách cơ sở
      </button>

      {/* Header */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 60, width: 150, height: 150, background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🏢</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>{branch.name}</h1>
                <span style={{ background: branch.status === 'active' ? '#10b981' : '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {branch.status === 'active' ? 'Đang hoạt động' : 'Bảo trì'}
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{branch.code}</div>
              {branch.address && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>📍 {branch.address}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm">✏️ Sửa</button>
            <button className="btn btn-danger btn-sm">🗑 Xoá</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'TỔNG PHÒNG', value: branch.rooms?.length || 0, icon: '🏫', color: '#2563eb', bg: '#eff6ff' },
          { label: 'HOẠT ĐỘNG', value: activeRooms, icon: '✅', color: '#10b981', bg: '#ecfdf5' },
          { label: 'BẢO TRÌ', value: maintenanceRooms, icon: '🔧', color: '#f59e0b', bg: '#fffbeb' },
          { label: 'SỨC CHỨA', value: totalCapacity, icon: '👥', color: '#06b6d4', bg: '#ecfeff' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ flex: 1 }}><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
            <div className="stat-icon" style={{ background: s.bg, fontSize: 22 }}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Rooms */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Phòng học</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'white', padding: 4, borderRadius: 8, boxShadow: 'var(--shadow)' }}>
            {[{ v: 'all', l: 'Tất cả' }, { v: 'active', l: 'Hoạt động' }, { v: 'maintenance', l: 'Bảo trì' }, { v: 'inactive', l: 'Vô hiệu' }].map(opt => (
              <button key={opt.v} onClick={() => setRoomFilter(opt.v)}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: roomFilter === opt.v ? 'var(--primary)' : 'transparent', color: roomFilter === opt.v ? 'white' : 'var(--gray-500)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {opt.l}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddRoom(true)}><Plus size={13} /> Thêm phòng</button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 10 }}>{filteredRooms.length / (branch.rooms?.length || 1) * (branch.rooms?.length || 0)} / {branch.rooms?.length || 0} phòng</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {filteredRooms.length === 0
          ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>Không có phòng nào</div>
          : filteredRooms.map((room: any) => (
            <div key={room.id} className="card" style={{ borderLeft: `3px solid ${room.status === 'active' ? 'var(--success)' : room.status === 'maintenance' ? 'var(--warning)' : 'var(--gray-300)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, background: room.status === 'active' ? 'var(--success-light)' : 'var(--warning-light)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DoorOpen size={18} color={room.status === 'active' ? 'var(--success)' : 'var(--warning)'} />
                </div>
                <StatusBadge status={room.status} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{room.name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 10 }}>{room.code}</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min((room.capacity / 50) * 100, 100)}%`, background: 'var(--warning)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>{room.capacity} chỗ</span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingRoom(room)} style={{ flex: 1, justifyContent: 'center' }}><Pencil size={12} /> Sửa</button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeletingRoom(room)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
      </div>

      {showAddRoom && <RoomForm branchId={parseInt(id!)} onClose={() => setShowAddRoom(false)} onSuccess={load} />}
      {editingRoom && <RoomForm branchId={parseInt(id!)} initial={editingRoom} onClose={() => setEditingRoom(null)} onSuccess={load} />}
      {deletingRoom && <ConfirmDialog message={`Xoá phòng "${deletingRoom.name}"?`} onConfirm={handleDeleteRoom} onCancel={() => setDeletingRoom(null)} />}
    </div>
  );
}
