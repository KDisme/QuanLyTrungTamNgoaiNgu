import React, { useCallback, useEffect, useState } from 'react';
import { History, Search, UserRound, Plus, Pencil, Trash2, CheckCircle2, Wallet, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { activityLogApi } from '../../api';
import { Badge, EmptyState, Loading } from '../../components/common';

const ACTION_TYPES = [
  { value: 'create', label: 'Tạo mới' },
  { value: 'update', label: 'Cập nhật' },
  { value: 'delete', label: 'Xoá' },
  { value: 'grade', label: 'Chấm điểm' },
  { value: 'payment', label: 'Thanh toán' },
];

const ENTITY_TYPES = [
  { value: 'class', label: 'Lớp học' },
  { value: 'user', label: 'Tài khoản' },
  { value: 'homework', label: 'Bài tập về nhà (tạo/sửa/xoá)' },
  { value: 'homework_submission', label: 'Chấm bài tập' },
  { value: 'mock_exam_student', label: 'Bài thi thử' },
  { value: 'fee_collection', label: 'Đợt thu học phí' },
  { value: 'fee_transaction', label: 'Giao dịch học phí' },
];

const ACTION_META: Record<string, { label: string; variant: string; icon: any }> = {
  create: { label: 'Tạo mới', variant: 'green', icon: Plus },
  update: { label: 'Cập nhật', variant: 'blue', icon: Pencil },
  delete: { label: 'Xoá', variant: 'red', icon: Trash2 },
  grade: { label: 'Chấm điểm', variant: 'purple', icon: CheckCircle2 },
  payment: { label: 'Thanh toán', variant: 'orange', icon: Wallet },
};

function formatRelativeTime(dateInput: string) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatFullTime(dateInput: string) {
  const date = new Date(dateInput);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function initials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || '';
  return last.charAt(0).toUpperCase();
}

function ActionBadge({ actionType }: { actionType: string }) {
  const meta = ACTION_META[actionType] || { label: actionType, variant: 'gray', icon: History };
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant as any}>
      <Icon size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
      {meta.label}
    </Badge>
  );
}

function LogRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <div style={{ display: 'flex', gap: 14, padding: '16px 4px', borderBottom: '1px solid var(--gray-100)' }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-light, #eff6ff)',
        color: 'var(--primary, #2563eb)', display: 'grid', placeItems: 'center', fontWeight: 800,
        fontSize: 14, flex: 'none',
      }}>
        {initials(log.actorName)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            <strong>{log.actorName || 'Hệ thống'}</strong>{' '}
            <span style={{ color: 'var(--gray-700)' }}>{log.description}</span>
          </div>
          <span title={formatFullTime(log.createdAt)} style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap', flex: 'none' }}>
            {formatRelativeTime(log.createdAt)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <ActionBadge actionType={log.actionType} />
          {log.actorRole && <Badge variant="gray">{log.actorRole}</Badge>}
          {hasMetadata && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                border: 'none', background: 'none', color: 'var(--primary, #2563eb)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '2px 6px',
              }}
            >
              {expanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
            </button>
          )}
        </div>

        {expanded && hasMetadata && (
          <div style={{
            marginTop: 10, background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
            borderRadius: 10, padding: 12, fontSize: 12, fontFamily: 'monospace',
            color: 'var(--gray-700)', overflowX: 'auto',
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actors, setActors] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [actorId, setActorId] = useState('');
  const [actionType, setActionType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    activityLogApi.getActors().then((res) => setActors(res.data.actors || [])).catch(() => setActors([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityLogApi.getAll({
        search: search || undefined,
        actorId: actorId || undefined,
        actionType: actionType || undefined,
        entityType: entityType || undefined,
        startDate: startDate || undefined,
        endDate: endDate ? `${endDate}T23:59:59` : undefined,
        page,
        limit,
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, actorId, actionType, entityType, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = () => {
    setSearch('');
    setActorId('');
    setActionType('');
    setEntityType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasActiveFilters = !!(search || actorId || actionType || entityType || startDate || endDate);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Lịch sử hoạt động</h1>
          <p className="page-subtitle">Theo dõi toàn bộ hoạt động quan trọng trong hệ thống — ai đã làm gì và khi nào.</p>
        </div>
      </div>

      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
        <div className="search-input">
          <Search className="search-icon" size={14} />
          <input
            className="form-input"
            placeholder="Tìm theo mô tả, người thực hiện..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select className="form-select" style={{ width: 200 }} value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(1); }}>
          <option value="">Tất cả người thực hiện</option>
          {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select className="form-select" style={{ width: 170 }} value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }}>
          <option value="">Tất cả hành động</option>
          {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select className="form-select" style={{ width: 190 }} value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">Tất cả đối tượng</option>
          {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <input
          type="date"
          className="form-input"
          style={{ width: 150 }}
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
        />
        <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>đến</span>
        <input
          type="date"
          className="form-input"
          style={{ width: 150 }}
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
        />

        {hasActiveFilters && (
          <button className="btn btn-secondary btn-sm" onClick={resetFilters}>
            <Filter size={12} /> Xoá bộ lọc
          </button>
        )}
      </div>

      <div className="card" style={{ padding: '4px 20px' }}>
        {loading ? (
          <Loading />
        ) : logs.length === 0 ? (
          <EmptyState message={hasActiveFilters ? 'Không tìm thấy hoạt động nào khớp bộ lọc' : 'Chưa có hoạt động nào được ghi nhận'} />
        ) : (
          <div>
            {logs.map((log) => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>

      {!loading && total > limit && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            Trang {page}/{totalPages} · Tổng {total} hoạt động
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Trước
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}