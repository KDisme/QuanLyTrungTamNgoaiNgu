import React, { useCallback, useEffect, useState } from 'react';
import { Search, Users2 } from 'lucide-react';
import { classesApi, usersApi } from '../../../api';
import { Badge, EmptyState, Loading, Modal } from '../../../components/common';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export default function ClassPickerModal({
  selectedIds,
  onClose,
  onConfirm,
}: {
  selectedIds: number[];
  onClose: () => void;
  onConfirm: (result: { ids: number[] }) => void;
}) {
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [status, setStatus] = useState('active');
  const [localSelected, setLocalSelected] = useState<Set<number>>(new Set(selectedIds));

  useEffect(() => {
    usersApi.getAll({ role: 'teacher', limit: 200 }).then((res) => setTeachers(res.data.users || [])).catch(() => setTeachers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await classesApi.getAll({
        search: search || undefined,
        teacherId: teacherId || undefined,
        status: status || undefined,
        limit: 300,
      });
      setClasses(res.data.classes || []);
    } finally {
      setLoading(false);
    }
  }, [search, teacherId, status]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = classes.length > 0 && classes.every((c) => localSelected.has(c.id));

  const selectAllVisible = () => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      classes.forEach((c) => {
        if (allVisibleSelected) next.delete(c.id);
        else next.add(c.id);
      });
      return next;
    });
  };

  return (
    <Modal
      title="Chọn lớp áp dụng"
      size="xl"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm({ ids: Array.from(localSelected) })}
          >
            Xác nhận ({localSelected.size} lớp)
          </button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="filter-bar">
          <div className="search-input">
            <Search className="search-icon" size={14} />
            <input className="form-input" placeholder="Tìm theo tên hoặc mã lớp..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 220 }} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Tất cả giáo viên</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <select className="form-select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="upcoming">Sắp khai giảng</option>
            <option value="active">Đang hoạt động</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="cancelled">Đã huỷ</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            Tìm thấy {classes.length} lớp — Đã chọn {localSelected.size} lớp
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllVisible} disabled={classes.length === 0}>
            <Users2 size={12} /> {allVisibleSelected ? 'Bỏ chọn tất cả (đang hiện)' : 'Chọn tất cả (đang hiện)'}
          </button>
        </div>

        {loading ? <Loading /> : classes.length === 0 ? (
          <EmptyState message="Không tìm thấy lớp phù hợp với bộ lọc" />
        ) : (
          <div className="table-container" style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Lớp học</th>
                  <th>Giáo viên</th>
                  <th>Phòng học</th>
                  <th>Ngày bắt đầu</th>
                  <th>Ngày kết thúc</th>
                  <th>Học viên</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((item) => {
                  const checked = localSelected.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      style={{ cursor: 'pointer', background: checked ? '#eff6ff' : undefined }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <Badge variant="gray">{item.code}</Badge>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{item.primary_teacher_name || 'Chưa phân công'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{item.room_names || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.start_date)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.end_date)}</td>
                      <td><Badge variant="blue">{item.student_count || 0} HV</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}