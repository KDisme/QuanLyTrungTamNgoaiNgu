import React, { useCallback, useEffect, useState } from 'react';
import { Search, Users2 } from 'lucide-react';
import { classesApi, usersApi } from '../../../api';
import { Badge, EmptyState, Loading, Modal } from '../../../components/common';

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

  const nameCounts = classes.reduce((acc: Record<string, number>, c: any) => {
    acc[c.name] = (acc[c.name] || 0) + 1;
    return acc;
  }, {});

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
          <div style={{ display: 'grid', gap: 6, maxHeight: 460, overflowY: 'auto' }}>
            {classes.map((item) => {
              const checked = localSelected.has(item.id);
              const isDuplicateName = nameCounts[item.name] > 1;
              return (
                <label
                  key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'center',
                    padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, cursor: 'pointer',
                    background: checked ? '#eff6ff' : '#fff',
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                    <Badge variant="gray">{item.code}</Badge>
                    {isDuplicateName && <Badge variant="orange">⚠ Trùng tên</Badge>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                    GV: {item.primary_teacher_name || 'Chưa phân công'}
                  </span>
                  <Badge variant="blue">{item.student_count || 0} HV</Badge>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}