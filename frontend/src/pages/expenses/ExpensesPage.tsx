import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Calendar } from 'lucide-react';
import { feesApi } from '../../api';
import { Modal, Loading, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';

const fmt = (n: any) => parseFloat(n || 0).toLocaleString('vi-VN');
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

const CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
  salary:    { label: 'Lương nhân viên', icon: '👤', color: '#2563eb' },
  rent:      { label: 'Thuê mặt bằng',  icon: '🏠', color: '#7c3aed' },
  utilities: { label: 'Điện/Nước',       icon: '💡', color: '#d97706' },
  supplies:  { label: 'Văn phòng phẩm', icon: '📦', color: '#059669' },
  marketing: { label: 'Marketing',       icon: '📣', color: '#db2777' },
  equipment: { label: 'Thiết bị',        icon: '🖥️', color: '#0891b2' },
  other:     { label: 'Khác',            icon: '🔄', color: '#6b7280' },
};

const PM_OPTS = ['cash', 'transfer', 'card', 'other'];
const PM_LABEL: Record<string, string> = {
  cash: '💵 Tiền mặt', transfer: '🏦 Chuyển khoản', card: '💳 Thẻ', other: '🔄 Khác',
};

function ExpenseForm({ initial, onClose, onSuccess }: { initial?: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    amount: initial?.amount || '',
    category: initial?.category || 'other',
    description: initial?.description || '',
    paymentMethod: initial?.payment_method || 'cash',
    expenseDate: initial?.expense_date
      ? initial.expense_date.slice(0, 10)
      : new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(String(form.amount)) <= 0) { toast.error('Vui lòng nhập số tiền hợp lệ'); return; }
    if (!form.description.trim()) { toast.error('Vui lòng nhập mô tả'); return; }
    setLoading(true);
    try {
      if (initial) { await feesApi.updateExpense(initial.id, form); toast.success('Đã cập nhật chi phí'); }
      else { await feesApi.createExpense(form); toast.success('Đã thêm chi phí'); }
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={initial ? 'Sửa chi phí' : 'Thêm chi phí'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu'}</button></>}>
      <div className="form-group">
        <label className="form-label">Danh mục <span className="required">*</span></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {Object.entries(CATEGORIES).map(([v, c]) => (
            <div key={v} onClick={() => setForm(f => ({ ...f, category: v }))}
              style={{ border: `2px solid ${form.category === v ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 8, padding: '8px 6px', cursor: 'pointer', textAlign: 'center', background: form.category === v ? 'var(--primary-50)' : 'white' }}>
              <div style={{ fontSize: 20 }}>{c.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: form.category === v ? 'var(--primary)' : 'var(--gray-600)', marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Số tiền (VNĐ) <span className="required">*</span></label>
        <input className="form-input" type="number" min={1} placeholder="VD: 500000"
          value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        {form.amount && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{fmt(form.amount)}đ</div>}
      </div>
      <div className="form-group">
        <label className="form-label">Mô tả <span className="required">*</span></label>
        <input className="form-input" placeholder="VD: Mua bút, giấy in tháng 5..."
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Phương thức thanh toán</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {PM_OPTS.map(v => (
            <button key={v} type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: v }))}
              style={{ flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.paymentMethod === v ? 'var(--primary)' : 'var(--gray-200)'}`, background: form.paymentMethod === v ? 'var(--primary-50)' : 'white', color: form.paymentMethod === v ? 'var(--primary)' : 'var(--gray-600)' }}>
              {PM_LABEL[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Ngày chi</label>
        <input className="form-input" type="date" value={form.expenseDate}
          onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
      </div>
    </Modal>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feesApi.getExpenses({ category: categoryFilter || undefined, startDate: startDate || undefined, endDate: endDate || undefined });
      setExpenses(res.data.expenses || []);
      setTotal(res.data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [categoryFilter, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xóa chi phí này?')) return;
    try { await feesApi.deleteExpense(id); toast.success('Đã xóa chi phí'); load(); }
    catch { toast.error('Không thể xóa'); }
  };

  const filtered = expenses.filter(e =>
    !search || e.description?.toLowerCase().includes(search.toLowerCase()) ||
    (CATEGORIES[e.category]?.label || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalAmount = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const byCategory = Object.entries(
    expenses.reduce((acc: Record<string, number>, e) => { acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount || 0); return acc; }, {})
  ).sort((a, b) => (b[1] as number) - (a[1] as number));

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Quản lý chi phí</h1>
          <p className="page-subtitle">Theo dõi và quản lý các khoản chi phí hoạt động</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={15} /> Thêm chi phí
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#fff7ed', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>TỔNG CHI PHÍ</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f97316', margin: '6px 0' }}>{fmt(totalAmount)}đ</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{total} khoản chi</div>
        </div>
        {byCategory.slice(0, 3).map(([cat, amt]) => {
          const c = CATEGORIES[cat] || CATEGORIES.other;
          return (
            <div key={cat} style={{ background: '#f9fafb', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{c.label.toUpperCase()}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{fmt(amt as number)}đ</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {totalAmount > 0 ? (((amt as number) / totalAmount) * 100).toFixed(0) : 0}% tổng chi
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input style={{ padding: '8px 14px 8px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', width: 220 }}
            placeholder="Tìm theo mô tả..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13 }}
          value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {Object.entries(CATEGORIES).map(([v, c]) => <option key={v} value={v}>{c.icon} {c.label}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={14} color="#9ca3af" />
          <input style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13 }} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span style={{ color: '#9ca3af' }}>—</span>
          <input style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13 }} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        {(categoryFilter || startDate || endDate) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setCategoryFilter(''); setStartDate(''); setEndDate(''); }}>Xóa bộ lọc</button>
        )}
      </div>

      {loading ? <Loading /> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>NGÀY</th><th>DANH MỤC</th><th>SỐ TIỀN</th><th>MÔ TẢ</th><th>THANH TOÁN</th><th>NGƯỜI TẠO</th><th>THAO TÁC</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={7}><EmptyState message="Chưa có khoản chi phí nào. Nhấn 'Thêm chi phí' để bắt đầu!" /></td></tr>
                  : filtered.map(e => {
                    const cat = CATEGORIES[e.category] || CATEGORIES.other;
                    return (
                      <tr key={e.id}>
                        <td><div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDate(e.expense_date)}</div></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{cat.icon}</span>
                            <span style={{ fontWeight: 600, fontSize: 13, color: cat.color }}>{cat.label}</span>
                          </div>
                        </td>
                        <td><span style={{ fontWeight: 700, fontSize: 15, color: '#dc2626' }}>{fmt(e.amount)}đ</span></td>
                        <td style={{ maxWidth: 200 }}><div style={{ fontSize: 13, color: 'var(--gray-700)' }}>{e.description || '—'}</div></td>
                        <td><span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>{PM_LABEL[e.payment_method] || e.payment_method}</span></td>
                        <td style={{ fontSize: 13, color: '#6b7280' }}>{e.created_by_name || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" title="Sửa" onClick={() => { setEditing(e); setShowForm(true); }}><Pencil size={13} /></button>
                            <button className="btn btn-danger btn-sm" title="Xóa" onClick={() => handleDelete(e.id)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
              <span>Hiển thị {filtered.length}/{total} khoản chi</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>Tổng: {fmt(filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}đ</span>
            </div>
          )}
        </div>
      )}

      {showForm && <ExpenseForm initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSuccess={load} />}
    </div>
  );
}
