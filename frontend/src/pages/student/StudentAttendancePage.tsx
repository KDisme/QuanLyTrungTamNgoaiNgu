import React, { useEffect, useState } from 'react';
import { attendanceApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../../components/common';

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi.getStudentAttendance(user!.id)
      .then(r => setRows(Array.isArray(r.data) ? r.data : r.data?.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Điểm danh của tôi</h1><div className="page-subtitle">Theo dõi số buổi có mặt, vắng và ghi chú của giáo viên</div></div>
      <div className="card">
        <table className="table"><thead><tr><th>Ngày học</th><th>Lớp</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>
          {rows.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>Chưa có dữ liệu điểm danh</td></tr> : rows.map((r, i) => (
            <tr key={r.id || i}><td>{r.session_date ? new Date(r.session_date).toLocaleDateString('vi-VN') : '-'}</td><td>{r.class_name || '-'}</td><td><span className={`status-badge ${r.status || 'pending'}`}>{r.status || 'pending'}</span></td><td>{r.note || ''}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}
