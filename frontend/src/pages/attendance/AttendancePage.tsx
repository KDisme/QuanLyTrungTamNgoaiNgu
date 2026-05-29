import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { schedulesApi, classesApi, branchesApi } from '../../api';
import { Loading } from '../../components/common';

const PAGE_SIZE = 50;
const SHOW_BRANCH_UI = false;

export default function AttendancePage() {
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('tenantSlug');
  const portalBase = window.location.pathname.match(/^\/[^/]+\/(admin|staff|teacher|student)/)?.[0] || `/${tenantSlug}`;

  const [branches, setBranches] = useState<any[]>([]);
  const [classes, setClasses]   = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [filters, setFilters] = useState({
    search: '', branchId: '', classId: '', fromDate: '', toDate: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      branchesApi.getAll({ limit: 200 }),
      classesApi.getAll({ limit: 200 }),
    ]).then(([brRes, clsRes]) => {
      setBranches(brRes.data.branches || []);
      setClasses(clsRes.data.classes || []);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await schedulesApi.getList({
        branchId:  SHOW_BRANCH_UI ? (filters.branchId || undefined) : undefined,
        classId:   filters.classId   || undefined,
        fromDate:  filters.fromDate  || undefined,
        toDate:    filters.toDate    || undefined,
        page,
        limit: PAGE_SIZE,
      });
      const all = (res.data.schedules || []).filter((s: any) =>
        s.class_name?.toLowerCase().includes(filters.search.toLowerCase())
      );
      setSchedules(all);
      setTotal(res.data.total ?? 0);
    } catch {
    } finally { setLoading(false); }
  }, [filters.branchId, filters.classId, filters.fromDate, filters.toDate, filters.search, page]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filters.branchId, filters.classId, filters.fromDate, filters.toDate, filters.search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleAttendance = (s: any) => {
    navigate(`${portalBase}/attendance/take/${s.id}`);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý Điểm danh</h1>
        <p className="page-subtitle">Điểm danh cho các buổi học đã lên lịch</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-bar" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <input
              className="form-input"
              placeholder="Tìm theo tên lớp..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          {SHOW_BRANCH_UI && (
            <select
              className="form-select" style={{ width: 160 }}
              value={filters.branchId}
              onChange={e => setFilters(f => ({ ...f, branchId: e.target.value }))}
            >
              <option value="">Cơ sở: Tất cả</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select
            className="form-select" style={{ width: 180 }}
            value={filters.classId}
            onChange={e => setFilters(f => ({ ...f, classId: e.target.value }))}
          >
            <option value="">Lớp: Tất cả</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Từ ngày</label>
            <input className="form-input" type="date" value={filters.fromDate}
              onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Đến ngày</label>
            <input className="form-input" type="date" value={filters.toDate}
              onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 48 }}><Loading /></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ngày &amp; Giờ</th>
                  <th>Lớp</th>
                  <th>Giáo viên</th>
                  <th>Phòng</th>
                  <th>Điểm danh</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
                      Không có buổi học nào
                    </td>
                  </tr>
                ) : schedules.map(s => {
                  const total = parseInt(s.student_count || 0);
                  const attended = parseInt(s.attended_count || 0);
                  const isCompleted = s.status === 'completed';
                  const rate = total ? Math.round((attended / total) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>
                          {new Date(s.session_date).toLocaleDateString('vi-VN')}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                          {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.class_name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.branch_name}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, color: '#6b7280' }}>👤</span>
                          {s.teacher_name || '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13 }}>🚪</span>
                          {s.room_name || '—'}
                        </div>
                      </td>
                      <td>
                        {total === 0 ? (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        ) : isCompleted ? (
                          <span style={{
                            fontWeight: 600, color: '#16a34a',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            {rate}% ({attended}/{total})
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>0% (0/{total})</span>
                        )}
                      </td>
                      <td>
                        {isCompleted ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleAttendance(s)}
                          >
                            <Pencil size={12} /> Cập nhật
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAttendance(s)}
                          >
                            📋 Điểm danh
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid #f3f4f6',
            fontSize: 13, color: '#6b7280',
          }}>
            <span>
              Hiển thị {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} trong {total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Trước
              </button>
              <span style={{ padding: '5px 12px', background: '#f3f4f6', borderRadius: 6, fontWeight: 600 }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
