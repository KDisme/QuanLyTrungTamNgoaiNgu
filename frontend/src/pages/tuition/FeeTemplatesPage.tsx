import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { feesApi } from '../../api';
import { Modal, Loading, EmptyState, ConfirmDialog } from '../../components/common';
import toast from 'react-hot-toast';

function TemplateForm({ initial, onClose, onSuccess }: { initial?: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: initial?.name || '', amount: initial?.amount || 0, description: initial?.description || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Vui lòng nhập tên mẫu'); return; }
    setLoading(true);
    try {
      if (initial) { await feesApi.updateTemplate(initial.id, form); toast.success('Cập nhật thành công'); }
      else { await feesApi.createTemplate(form); toast.success('Tạo mẫu thành công'); }
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={initial ? 'Sửa mẫu học phí' : 'Thêm mẫu học phí'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? '...' : 'Lưu'}</button></>}>
      <div className="form-group">
        <label className="form-label">Tên mẫu <span className="required">*</span></label>
        <input className="form-input" placeholder="VD: Học phí tháng, Phí tài liệu..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Số tiền (đ)</label>
        <input className="form-input" type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Mô tả</label>
        <textarea className="form-textarea" placeholder="Mô tả..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
    </Modal>
  );
}

export default function FeeTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await feesApi.getTemplates(); setTemplates(res.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await feesApi.updateTemplate(deleting.id, { ...deleting, isActive: false });
      toast.success('Đã vô hiệu hoá mẫu'); setDeleting(null); load();
    } catch { toast.error('Không thể xoá'); }
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Mẫu học phí</h1>
          <p className="page-subtitle">Quản lý các mẫu phí dùng khi tạo đợt thu</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Thêm mẫu</button>
      </div>

      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {templates.length === 0
            ? <div style={{ gridColumn: '1/-1' }}><EmptyState message="Chưa có mẫu học phí nào" /></div>
            : templates.map(t => (
              <div key={t.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, background: 'var(--primary-50)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(t)}><Pencil size={12} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleting(t)}><Trash2 size={12} /></button>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
                {t.description && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>{t.description}</div>}
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                  {parseFloat(t.amount).toLocaleString('vi-VN')}đ
                </div>
              </div>
            ))}
        </div>
      )}

      {showAdd && <TemplateForm onClose={() => setShowAdd(false)} onSuccess={load} />}
      {editing && <TemplateForm initial={editing} onClose={() => setEditing(null)} onSuccess={load} />}
      {deleting && <ConfirmDialog message={`Vô hiệu hoá mẫu "${deleting.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  );
}
