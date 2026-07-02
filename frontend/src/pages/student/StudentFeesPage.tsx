import React, { useEffect, useState } from 'react';
import { feesApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../../components/common';

const fmt = (n: any) => parseFloat(n || 0).toLocaleString('vi-VN') + 'đ';

export default function StudentFeesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    feesApi.getStudentCollections(user!.id)
      .then(r => setRows(Array.isArray(r.data) ? r.data : r.data?.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Học phí của tôi</h1><div className="page-subtitle">Chỉ hiển thị học phí thuộc tài khoản học viên hiện tại</div></div>
      <div className="card">
        <table className="table"><thead><tr><th>Đợt thu</th><th>Số tiền</th><th>Đã đóng</th><th>Còn lại</th><th>Trạng thái</th></tr></thead><tbody>
          {rows.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>Chưa có dữ liệu học phí</td></tr> : rows.map((r, i) => {
            const amount = r.amount || r.total_amount || 0;
            const paid = r.paid_amount || 0;
            return <tr key={r.id || i}><td>{r.collection_name || r.name || r.title || '-'}</td><td>{fmt(amount)}</td><td>{fmt(paid)}</td><td>{fmt(Number(amount) - Number(paid))}</td><td><span className={`status-badge ${r.status || 'pending'}`}>{r.status || 'pending'}</span></td></tr>;
          })}
        </tbody></table>
      </div>
    </div>
  );
}
