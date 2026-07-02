import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Eye, Lock, X, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, Search, ArrowLeft } from 'lucide-react';
import { feesApi, classesApi } from '../../api';
import { StatusBadge, Modal, Loading, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';

// ---- HELPERS ----
const fmt = (n: any) => parseFloat(n || 0).toLocaleString('vi-VN');
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

const PM_OPTS = [
  { v: 'cash', l: '💵 Tiền mặt' },
  { v: 'transfer', l: '🏦 Chuyển khoản' },
  { v: 'momo', l: '🟣 MoMo' },
  { v: 'zalopay', l: '🔵 ZaloPay' },
  { v: 'vnpay', l: '🔴 VNPay/QR' },
  { v: 'card', l: '💳 Thẻ' },
];
const PM_LABEL: Record<string, string> = {
  cash: '💵 Tiền mặt', transfer: '🏦 Chuyển khoản',
  momo: '🟣 MoMo', zalopay: '🔵 ZaloPay', vnpay: '🔴 VNPay/QR', card: '💳 Thẻ', other: '🔄 Khác',
};

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  draft:    { bg: '#f3f4f6', color: '#6b7280', label: 'Nháp' },
  active:   { bg: '#dcfce7', color: '#16a34a', label: 'Đang hoạt động' },
  closed:   { bg: '#dbeafe', color: '#2563eb', label: 'Đã đóng' },
  cancelled:{ bg: '#fee2e2', color: '#dc2626', label: 'Đã hủy' },
};

// ---- PAYMENT MODAL ----
function PaymentModal({ item, collectorName, onClose, onSuccess }: { item: any; collectorName?: string; onClose: () => void; onSuccess: () => void }) {
  const remaining = parseFloat(item.amount_due) - parseFloat(item.amount_paid);
  const [payAll, setPayAll] = useState(true);
  const [form, setForm] = useState({
    amount: remaining,
    paymentMethod: 'cash',
    note: '',
    paidDate: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(f => ({ ...f, amount: payAll ? remaining : f.amount }));
  }, [payAll, remaining]);

  const handleSubmit = async () => {
    if (!form.amount || form.amount <= 0) { toast.error('Số tiền không hợp lệ'); return; }
    if (form.amount > remaining + 0.01) { toast.error(`Tối đa ${fmt(remaining)}đ`); return; }
    setLoading(true);
    try {
      await feesApi.recordPayment(item.id, form);
      toast.success('Đã ghi nhận thanh toán thành công!');
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Thu tiền học phí" onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Đang lưu...' : 'Xác nhận thanh toán'}</button></>}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{item.full_name} <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>({item.student_code})</span></div>
      </div>
      {/* Fee summary */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 8 }}>💰 Thông tin học phí</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
          {[
            { label: 'Tổng học phí', value: fmt(item.amount_due) + 'đ', color: '#374151' },
            { label: 'Đã thanh toán', value: fmt(item.amount_paid) + 'đ', color: '#16a34a' },
            { label: 'Còn phải trả', value: fmt(remaining) + 'đ', color: '#dc2626' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 8, padding: '8px 4px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: s.color, marginTop: 3 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="form-group">
        <label className="form-label">Số tiền thu lần này (VNĐ) <span className="required">*</span></label>
        <input className="form-input" type="number" min={1} max={remaining}
          value={form.amount}
          onChange={e => { setPayAll(false); setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 })); }} />
        <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>{fmt(form.amount)}đ</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={payAll} onChange={e => setPayAll(e.target.checked)} />
          Thu đủ số tiền còn lại ({fmt(remaining)}đ)
        </label>
        {form.amount < remaining && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#2563eb' }}>
            Sau khi thanh toán, số tiền còn lại: <strong>{fmt(remaining - form.amount)}đ</strong>
          </div>
        )}
      </div>

      {/* Payment method */}
      <div className="form-group">
        <label className="form-label">Phương thức thanh toán <span className="required">*</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PM_OPTS.map(opt => (
            <button key={opt.v} type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: opt.v }))}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${form.paymentMethod === opt.v ? 'var(--primary)' : 'var(--gray-200)'}`, background: form.paymentMethod === opt.v ? 'var(--primary-50)' : 'white', color: form.paymentMethod === opt.v ? 'var(--primary)' : 'var(--gray-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="form-group">
        <label className="form-label">Ngày thanh toán <span className="required">*</span></label>
        <input className="form-input" type="date" value={form.paidDate} onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))} />
      </div>

      {/* Collector */}
      {collectorName && (
        <div className="form-group">
          <label className="form-label">Người thu tiền</label>
          <input className="form-input" value={collectorName} disabled style={{ background: '#f9fafb', color: '#6b7280' }} />
        </div>
      )}

      {/* Note */}
      <div className="form-group">
        <label className="form-label">Ghi chú thanh toán</label>
        <textarea className="form-textarea" placeholder="VD: Đóng đợt 2, thanh toán qua Momo..." value={form.note}
          onChange={e => setForm(f => ({ ...f, note: e.target.value }))} maxLength={200} style={{ minHeight: 70 }} />
        <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af' }}>{form.note.length}/200 ký tự</div>
      </div>
    </Modal>
  );
}

// ---- TRANSACTION HISTORY MODAL ----
function HistoryModal({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    feesApi.getItemHistory(itemId).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (txId: number) => {
    if (!window.confirm('Hủy giao dịch này? Số tiền đã thu sẽ bị hoàn lại.')) return;
    setCancelling(txId);
    try {
      await feesApi.cancelTransaction(txId);
      toast.success('Đã hủy giao dịch');
      load();
    } catch { toast.error('Không thể hủy giao dịch'); }
    finally { setCancelling(null); }
  };

  return (
    <Modal title="Lịch sử Thanh toán" onClose={onClose}
      footer={<button className="btn btn-primary" onClick={onClose}>Đóng</button>}>
      {loading ? <Loading /> : !data ? null : (
        <>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Học viên: {data.full_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Tổng học phí', value: fmt(data.amount_due) + 'đ', color: '#374151' },
              { label: 'Đã thanh toán', value: fmt(data.amount_paid) + 'đ', color: '#16a34a' },
              { label: 'Còn lại', value: fmt(parseFloat(data.amount_due) - parseFloat(data.amount_paid)) + 'đ', color: parseFloat(data.amount_due) > parseFloat(data.amount_paid) ? '#dc2626' : '#16a34a' },
            ].map(s => (
              <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontWeight: 700, color: s.color, marginTop: 3 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
            Lịch sử thanh toán ({data.transactions?.length || 0} lần)
          </div>
          {!data.transactions?.length ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>Chưa có giao dịch nào</div>
          ) : data.transactions.map((tx: any) => (
            <div key={tx.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: tx.is_cancelled ? '#fef2f2' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: tx.is_cancelled ? '#dc2626' : '#16a34a' }}>
                      {tx.is_cancelled ? '—' : '+'}{fmt(tx.amount)}đ
                    </span>
                    {tx.is_cancelled && <span style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Đã hủy</span>}
                    <span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '1px 6px', borderRadius: 4 }}>Hoàn tất</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{tx.bill_number} · {PM_LABEL[tx.payment_method] || tx.payment_method}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {fmtDate(tx.paid_date || tx.paid_at)}
                    {tx.collected_by_name && ` · ${tx.collected_by_name}`}
                  </div>
                  {tx.note && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, fontStyle: 'italic' }}>"{tx.note}"</div>}
                  {tx.is_cancelled && tx.cancelled_at && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>Hủy lúc {new Date(tx.cancelled_at).toLocaleString('vi-VN')}</div>
                  )}
                </div>
                {!tx.is_cancelled && (
                  <button className="btn btn-secondary btn-sm" disabled={cancelling === tx.id} onClick={() => handleCancel(tx.id)}
                    style={{ fontSize: 11 }}>
                    ⚙️ Quản lý
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

// ---- STUDENT ROW ----
function StudentItemRow({ item, collectionStatus, onPay, onHistory }: any) {
  const remaining = parseFloat(item.amount_due) - parseFloat(item.amount_paid);
  const pct = parseFloat(item.amount_due) > 0 ? Math.round((parseFloat(item.amount_paid) / parseFloat(item.amount_due)) * 100) : 0;
  const activeTxs = (item.transactions || []).filter((t: any) => !t.is_cancelled);

  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#fef9c3', color: '#854d0e', label: 'Chưa đóng' },
    partial:  { bg: '#fef3c7', color: '#92400e', label: 'Đóng một phần' },
    paid:     { bg: '#dcfce7', color: '#166534', label: 'Đã đóng' },
    cancelled:{ bg: '#f3f4f6', color: '#6b7280', label: 'Đã hủy' },
  };
  const st = statusStyle[item.status] || statusStyle.pending;

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{item.full_name}</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.student_code}</div>
      </td>
      <td style={{ fontWeight: 600 }}>{fmt(item.amount_due)}đ</td>
      <td>
        <div style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(item.amount_paid)}đ</div>
        <div style={{ width: 80, height: 4, background: '#e5e7eb', borderRadius: 2, marginTop: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#16a34a' : '#2563eb', borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </td>
      <td style={{ color: remaining > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
        {remaining > 0 ? fmt(remaining) + 'đ' : '✓ Đủ'}
      </td>
      <td>
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          {item.status !== 'paid' && collectionStatus === 'active' && (
            <button className="btn btn-primary btn-sm" onClick={onPay} style={{ fontSize: 12 }}>
              💰 Thu tiền
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onHistory} style={{ fontSize: 12 }}>
            🕐 Lịch sử {activeTxs.length > 0 && `(${activeTxs.length})`}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---- COLLECTION DETAIL PAGE ----
function CollectionDetailPage({ id, onBack }: { id: number; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<any>(null);
  const [viewingHistory, setViewingHistory] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activating, setActivating] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    feesApi.getCollectionById(id).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async () => {
    if (!window.confirm('Kích hoạt đợt thu và tạo hóa đơn cho học viên?')) return;
    setActivating(true);
    try { await feesApi.activateCollection(id); toast.success('Đã kích hoạt và tạo hóa đơn thành công!'); load(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Không thể kích hoạt'); }
    finally { setActivating(false); }
  };

  const handleClose = async () => {
    if (!window.confirm('Đóng đợt thu này? Không thể thu tiền sau khi đóng.')) return;
    setClosing(true);
    try { await feesApi.closeCollection(id); toast.success('Đã đóng đợt thu'); load(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Không thể đóng'); }
    finally { setClosing(false); }
  };

  if (loading) return <Loading />;
  if (!data) return <div>Không tìm thấy đợt thu</div>;

  const items: any[] = data.items || [];
  const filtered = items.filter((i: any) => {
    const matchSearch = !search || i.full_name?.toLowerCase().includes(search.toLowerCase()) || i.student_code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const collected = items.reduce((s, i) => s + parseFloat(i.amount_paid || 0), 0);
  const totalDue = items.reduce((s, i) => s + parseFloat(i.amount_due || 0), 0);
  const pctTotal = totalDue > 0 ? Math.round((collected / totalDue) * 100) : 0;
  const paidCount = items.filter(i => i.status === 'paid').length;
  const partialCount = items.filter(i => i.status === 'partial').length;
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const remaining = totalDue - collected;

  const st = STATUS_COLOR[data.status] || STATUS_COLOR.draft;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ gap: 6 }}>
            <ArrowLeft size={14} /> Quay lại
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{data.name}</h1>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {data.collection_code} · {fmtDate(data.start_date)} – {fmtDate(data.end_date || data.due_date)}
            </div>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data.status === 'draft' && (
            <button className="btn btn-primary" onClick={handleActivate} disabled={activating}>
              ▶ Kích hoạt &amp; Tạo hóa đơn
            </button>
          )}
          {data.status === 'active' && (
            <button className="btn btn-secondary" onClick={handleClose} disabled={closing}>
              <Lock size={14} /> Đóng đợt thu
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'HỌC VIÊN', value: items.length, icon: '👥', bg: '#eff6ff', color: '#2563eb' },
          { label: 'TỔNG THU', value: fmt(totalDue) + 'đ', icon: '💰', bg: '#f0fdf4', color: '#16a34a' },
          { label: 'ĐÃ THU', value: fmt(collected) + 'đ', icon: '✅', bg: '#dcfce7', color: '#15803d' },
          { label: 'CÒN LẠI', value: fmt(remaining) + 'đ', icon: '⏳', bg: '#fef3c7', color: '#d97706' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{c.icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Tiến độ thu</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{pctTotal}%</span>
        </div>
        <div style={{ height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${pctTotal}%`, height: '100%', background: pctTotal >= 100 ? '#16a34a' : '#2563eb', borderRadius: 5, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'Đã đóng đủ', count: paidCount, color: '#16a34a', bg: '#dcfce7' },
            { label: 'Đóng một phần', count: partialCount, color: '#d97706', bg: '#fef3c7' },
            { label: 'Chưa đóng', count: pendingCount, color: '#dc2626', bg: '#fee2e2' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color }} />
              {s.label}: <strong style={{ color: s.color }}>{s.count}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Activate notice */}
      {data.status === 'draft' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#2563eb' }}>
          ℹ️ Đợt thu sẽ được tạo ở trạng thái <strong>Nháp</strong>. Bạn cần kích hoạt để tạo hóa đơn cho học viên.
        </div>
      )}

      {/* Invoice list */}
      {data.status !== 'draft' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Danh sách hóa đơn ({items.length})</div>
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input style={{ paddingLeft: 30, padding: '7px 14px 7px 30px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none' }}
                placeholder="Tìm tên học viên, số hóa đơn..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select style={{ padding: '7px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chưa đóng</option>
              <option value="partial">Đóng một phần</option>
              <option value="paid">Đã đóng</option>
            </select>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>HỌC VIÊN</th><th>PHẢI ĐÓNG</th><th>ĐÃ ĐÓNG</th><th>CÒN LẠI</th><th>TRẠNG THÁI</th><th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={6}><EmptyState message="Kích hoạt đợt thu để tạo hóa đơn cho học viên" /></td></tr>
                  : filtered.map((item: any) => (
                    <StudentItemRow key={item.id} item={item} collectionStatus={data.status}
                      onPay={() => setPaying(item)}
                      onHistory={() => setViewingHistory(item.id)} />
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paying && <PaymentModal item={paying} onClose={() => setPaying(null)} onSuccess={load} />}
      {viewingHistory !== null && <HistoryModal itemId={viewingHistory} onClose={() => setViewingHistory(null)} />}
    </div>
  );
}

// ---- CREATE WIZARD (3 steps) ----
function CreateWizard({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    feeTemplateId: '' as any,
    name: '',
    description: '',
    cycleType: 'monthly',
    startDate: '',
    endDate: '',
    graceDays: 7,
    totalAmount: '' as any,
    scopeType: 'class',
    classIds: [] as number[],
  });

  useEffect(() => {
    Promise.all([feesApi.getTemplates(), classesApi.getAll({ limit: 200 })]).then(([t, c]) => {
      setTemplates(t.data || []);
      setClasses(c.data.classes || []);
    });
  }, []);

  const selectedTemplate = templates.find(t => t.id === form.feeTemplateId);
  const filteredClasses = classes.filter(c => !classSearch || c.name.toLowerCase().includes(classSearch.toLowerCase()) || c.code?.toLowerCase().includes(classSearch.toLowerCase()));
  const selectedClasses = classes.filter(c => form.classIds.includes(c.id));

  const toggleClass = (id: number) => {
    setForm(f => ({
      ...f,
      classIds: f.classIds.includes(id) ? f.classIds.filter(x => x !== id) : [...f.classIds, id],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await feesApi.createCollection({
        ...form,
        feeTemplateId: form.feeTemplateId || null,
        totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : (selectedTemplate?.amount || 0),
        classIds: form.classIds,
      });
      toast.success('Tạo đợt thu thành công!');
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  const canNext1 = form.name && (form.feeTemplateId || form.totalAmount);
  const canNext2 = form.classIds.length > 0 || form.scopeType === 'student';

  const steps = [
    { label: 'Thông tin', sub: 'Tên, học phí, thời gian' },
    { label: 'Phạm vi', sub: 'Lớp hoặc học viên' },
    { label: 'Xác nhận', sub: 'Kiểm tra & tạo' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', position: 'fixed', inset: 0, zIndex: 1000, overflowY: 'auto' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Tạo Đợt thu Học phí mới</h1>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Thiết lập đợt thu học phí cho lớp học hoặc học viên</p>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 14, padding: '18px 32px', boxShadow: 'var(--shadow)', marginBottom: 24 }}>
          {steps.map((s, i) => {
            const num = i + 1;
            const done = step > num;
            const active = step === num;
            return (
              <React.Fragment key={s.label}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, background: done ? 'var(--primary)' : active ? 'var(--primary)' : '#e5e7eb', color: done || active ? 'white' : '#9ca3af', marginBottom: 8 }}>
                    {done ? '✓' : num}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--primary)' : done ? 'var(--primary)' : '#9ca3af' }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.sub}</div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ height: 2, flex: 1, background: step > i + 1 ? 'var(--primary)' : '#e5e7eb', margin: '0 8px', marginBottom: 24 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step 1: Basic info */}
        {step === 1 && (
          <div style={{ background: 'white', borderRadius: 14, padding: 28, boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Thông tin cơ bản</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: -12, marginBottom: 20 }}>Chọn mẫu học phí, đặt tên và thiết lập thời gian áp dụng</p>

            <div className="form-group">
              <label className="form-label">Mẫu học phí <span className="required">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 10 }}>
                {templates.map(t => (
                  <div key={t.id} onClick={() => setForm(f => ({ ...f, feeTemplateId: t.id, totalAmount: t.amount }))}
                    style={{ border: `2px solid ${form.feeTemplateId === t.id ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: form.feeTemplateId === t.id ? 'var(--primary-50)' : 'white', position: 'relative' }}>
                    {form.feeTemplateId === t.id && <span style={{ position: 'absolute', top: 8, right: 8, color: 'var(--primary)' }}>✓</span>}
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>{fmt(t.amount)}đ</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tên đợt thu <span className="required">*</span></label>
              <input className="form-input" placeholder="VD: Thu học phí tháng 5/2026" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Mô tả (tùy chọn)</label>
              <textarea className="form-textarea" placeholder="Ghi chú hoặc mô tả thêm về đợt thu này..." value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={500} style={{ minHeight: 80 }} />
              <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af' }}>{form.description.length}/500</div>
            </div>

            <div className="form-group">
              <label className="form-label">Chu kỳ thanh toán</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { v: 'monthly', l: '📅 Theo tháng', sub: 'Mỗi tháng 1 lần' },
                  { v: 'semester', l: '📚 Theo học kỳ', sub: 'Mỗi học kỳ 1 lần' },
                  { v: 'one_time', l: '1️⃣ Một lần', sub: 'Thu duy nhất' },
                ].map(opt => (
                  <div key={opt.v} onClick={() => setForm(f => ({ ...f, cycleType: opt.v }))}
                    style={{ flex: 1, border: `2px solid ${form.cycleType === opt.v ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: form.cycleType === opt.v ? 'var(--primary-50)' : 'white', textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.l}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{opt.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Ngày bắt đầu <span className="required">*</span></label>
                <input className="form-input" type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Ngày kết thúc <span className="required">*</span></label>
                <input className="form-input" type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {form.startDate && form.endDate && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#15803d' }}>
                Thời lượng: {Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000)} ngày · Số ngày ân hạn: {form.graceDays} ngày
              </div>
            )}
          </div>
        )}

        {/* Step 2: Scope */}
        {step === 2 && (
          <div style={{ background: 'white', borderRadius: 14, padding: 28, boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Phạm vi áp dụng</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Chọn lớp học hoặc học viên sẽ chịu học phí của đợt thu này</p>

            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              {[
                { v: 'class', l: '🏫 Theo lớp học', sub: 'Áp dụng cho toàn bộ học viên trong lớp' },
                { v: 'student', l: '👤 Học viên cụ thể', sub: 'Chỉ áp dụng cho học viên đã chọn' },
              ].map(opt => (
                <div key={opt.v} onClick={() => setForm(f => ({ ...f, scopeType: opt.v }))}
                  style={{ flex: 1, border: `2px solid ${form.scopeType === opt.v ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', background: form.scopeType === opt.v ? 'var(--primary-50)' : 'white' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{opt.l}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{opt.sub}</div>
                </div>
              ))}
            </div>

            {form.scopeType === 'class' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input style={{ width: '100%', padding: '8px 14px 8px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      placeholder="Tìm tên lớp..."
                      value={classSearch} onChange={e => setClassSearch(e.target.value)} />
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Đã chọn {form.classIds.length}/{classes.length}</div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    onClick={() => setForm(f => ({ ...f, classIds: classes.map(c => c.id) }))}>Chọn tất cả</button>
                </div>

                {/* Selected chips */}
                {selectedClasses.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {selectedClasses.map(c => (
                      <span key={c.id} style={{ background: 'var(--primary)', color: 'white', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.name}
                        <X size={10} style={{ cursor: 'pointer' }} onClick={() => toggleClass(c.id)} />
                      </span>
                    ))}
                    <button onClick={() => setForm(f => ({ ...f, classIds: [] }))} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Bỏ chọn tất cả</button>
                  </div>
                )}

                <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 10 }}>
                  {filteredClasses.map(c => (
                    <div key={c.id} onClick={() => toggleClass(c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', background: form.classIds.includes(c.id) ? 'var(--primary-50)' : 'white' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14 }}>🏫</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.code}</div>
                      </div>
                      <input type="checkbox" readOnly checked={form.classIds.includes(c.id)}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                    </div>
                  ))}
                  {filteredClasses.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>Không tìm thấy lớp nào</div>}
                </div>
              </>
            )}

            {form.scopeType === 'student' && (
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: 20, textAlign: 'center', color: '#2563eb', fontSize: 13 }}>
                ℹ️ Tính năng chọn học viên cụ thể sẽ có thể thêm sau khi tạo đợt thu. Hiện tại vui lòng chọn theo lớp.
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div style={{ background: 'white', borderRadius: 14, padding: 28, boxShadow: 'var(--shadow)' }}>
            {/* Preview card */}
            <div style={{ background: '#eff6ff', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📋</div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 2 }}>SẴN SÀNG TẠO ĐỢT THU · Nháp</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{form.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{fmt(form.totalAmount || selectedTemplate?.amount || 0)}đ</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{selectedTemplate?.name || 'Mẫu tùy chỉnh'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>📋 Thông tin cơ bản</div>
                {[
                  { l: 'Tên đợt thu', v: form.name },
                  { l: 'Mẫu học phí', v: selectedTemplate ? `${selectedTemplate.name} (${fmt(selectedTemplate.amount)}đ)` : 'Tùy chỉnh' },
                  { l: 'Chu kỳ', v: { monthly: 'Theo tháng', semester: 'Theo học kỳ', one_time: 'Một lần' }[form.cycleType] || 'Theo tháng' },
                ].map(r => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                    <span style={{ color: '#6b7280' }}>{r.l}</span>
                    <strong style={{ textAlign: 'right', maxWidth: 180 }}>{r.v}</strong>
                  </div>
                ))}
              </div>

              <div style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>📅 Thời gian áp dụng</div>
                {[
                  { l: 'Ngày bắt đầu', v: fmtDate(form.startDate) },
                  { l: 'Ngày kết thúc', v: fmtDate(form.endDate) },
                  { l: 'Thời lượng', v: form.startDate && form.endDate ? `${Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000)} ngày (~1 tháng)` : '—' },
                  { l: 'Số ngày ân hạn', v: `${form.graceDays} ngày` },
                ].map(r => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                    <span style={{ color: '#6b7280' }}>{r.l}</span>
                    <strong>{r.v}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏫 Phạm vi áp dụng</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Theo lớp học · {selectedClasses.length} đối tượng đã chọn</div>
              {selectedClasses.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <span style={{ fontSize: 14 }}>🏫</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.code}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 13, color: '#2563eb' }}>
              ℹ️ Đợt thu sẽ được tạo ở trạng thái <strong>Nháp</strong>. Bạn cần kích hoạt để tạo hóa đơn cho học viên.
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            <ArrowLeft size={14} /> {step === 1 ? 'Quay lại' : 'Quay lại'}
          </button>
          {step < 3 ? (
            <button className="btn btn-primary" disabled={step === 1 ? !canNext1 : !canNext2}
              onClick={() => setStep(s => s + 1)}>
              Tiếp theo →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Đang tạo...' : '📋 Tạo đợt thu (Nháp)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- COLLECTION CARD ----
function CollectionCard({ col, onView }: { col: any; onView: () => void }) {
  const st = STATUS_COLOR[col.status] || STATUS_COLOR.draft;
  const collected = parseFloat(col.collected_amount || 0);
  const totalDue = parseFloat(col.total_due || 0);
  const pct = totalDue > 0 ? Math.round((collected / totalDue) * 100) : 0;

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--gray-100)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{col.name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{col.collection_code}</div>
          {col.start_date && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              📅 {fmtDate(col.start_date)} – {fmtDate(col.end_date || col.due_date)}
            </div>
          )}
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>
          {st.label}
        </span>
      </div>

      {col.class_names && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>🏫 {col.class_names}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>👥 HỌC VIÊN</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{col.total_items || 0}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✅ ĐÃ THU</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#16a34a' }}>{fmt(collected)}đ</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>⏳ CÒN LẠI</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#dc2626' }}>{fmt(Math.max(0, totalDue - collected))}đ</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          <span>Tiến độ thu</span><span style={{ fontWeight: 700, color: '#2563eb' }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#16a34a' : '#2563eb', borderRadius: 3, transition: 'width 0.5s' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onView}>
          <Eye size={13} /> Xem chi tiết
        </button>
        {col.status === 'draft' && (
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
            🔒 Đóng đợt
          </button>
        )}
      </div>
    </div>
  );
}

// ---- MAIN PAGE ----
export default function TuitionPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feesApi.getCollections({ status: statusFilter });
      setCollections(res.data.collections || []);
      setTotal(res.data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = collections.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.collection_code?.toLowerCase().includes(search.toLowerCase()));

  const activeCount = collections.filter(c => c.status === 'active').length;
  const draftCount = collections.filter(c => c.status === 'draft').length;
  const closedCount = collections.filter(c => c.status === 'closed').length;
  const totalCollected = collections.reduce((s, c) => s + parseFloat(c.collected_amount || 0), 0);

  if (showCreate) {
    return <CreateWizard onClose={() => setShowCreate(false)} onSuccess={load} />;
  }
  if (viewing !== null) {
    return <CollectionDetailPage id={viewing} onBack={() => setViewing(null)} />;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Quản lý Đợt thu Học phí</h1>
          <p className="page-subtitle">Quản lý các đợt thu học phí theo nhóm học viên</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => window.location.href = '#/fee-templates'}>
            📋 Báo cáo Tài chính
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Tạo đợt thu mới
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'TỔNG ĐỢT THU', value: total, icon: '📋', bg: '#eff6ff', color: '#2563eb' },
          { label: 'ĐANG HOẠT ĐỘNG', value: activeCount, icon: '✅', bg: '#dcfce7', color: '#16a34a' },
          { label: 'NHÁP', value: draftCount, icon: '📝', bg: '#f3f4f6', color: '#6b7280' },
          { label: 'TỔNG ĐÃ THU', value: fmt(totalCollected) + 'đ', icon: '💰', bg: '#fef3c7', color: '#d97706' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>{c.icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { v: '', l: 'Tất cả' },
          { v: 'active', l: '🟢 Đang hoạt động' },
          { v: 'draft', l: '📝 Nháp' },
          { v: 'closed', l: '🔒 Đã đóng' },
        ].map(tab => (
          <button key={tab.v} onClick={() => setStatusFilter(tab.v)}
            style={{ padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${statusFilter === tab.v ? 'var(--primary)' : 'var(--gray-200)'}`, background: statusFilter === tab.v ? 'var(--primary)' : 'white', color: statusFilter === tab.v ? 'white' : 'var(--gray-600)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {tab.l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input style={{ paddingLeft: 30, padding: '8px 14px 8px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none' }}
            placeholder="Tìm theo tên hoặc mã đợt thu..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <Loading /> : (
        <>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>Tìm thấy {filtered.length} đợt thu</div>
          {filtered.length === 0
            ? <EmptyState message="Chưa có đợt thu nào. Tạo đợt thu mới để bắt đầu!" />
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px,1fr))', gap: 16 }}>
                {filtered.map(col => (
                  <CollectionCard key={col.id} col={col} onView={() => setViewing(col.id)} />
                ))}
              </div>
            )
          }
        </>
      )}
    </div>
  );
}
