import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock3 } from 'lucide-react';
import { notificationsApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Badge, EmptyState, Loading } from '../../components/common';

const TYPE_LABELS: Record<string, { label: string; variant: 'blue' | 'green' | 'purple' | 'gray' }> = {
  homework_assigned: { label: 'Bài tập mới', variant: 'blue' },
  homework_graded: { label: 'Đã chấm điểm', variant: 'green' },
  system: { label: 'Hệ thống', variant: 'gray' },
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

export default function NotificationsPage() {
  const { tenantSlug } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getAll({ limit: 50 });
      setItems(res.data.items || []);
      setUnreadCount(res.data.unreadCount || 0);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNotification = async (item: any) => {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item.id);
        setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, isRead: true } : n));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    if (item.link) navigate(`/${tenantSlug}${item.link}`);
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Thông báo</h1>
          <p className="page-subtitle">Thông báo từ giáo viên và hệ thống{unreadCount > 0 ? ` — ${unreadCount} chưa đọc` : ''}</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead}><CheckCheck size={15} /> Đánh dấu tất cả đã đọc</button>
        )}
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState message="Bạn chưa có thông báo nào" />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item) => {
            const typeInfo = TYPE_LABELS[item.type] || TYPE_LABELS.system;
            return (
              <div
                key={item.id}
                onClick={() => openNotification(item)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16,
                  border: '1px solid var(--gray-200)', borderRadius: 14,
                  background: item.isRead ? '#fff' : '#eff6ff',
                  cursor: item.link ? 'pointer' : 'default',
                  transition: 'box-shadow 0.15s ease',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center',
                  background: item.isRead ? 'var(--gray-100)' : 'var(--primary-light)',
                }}>
                  <Bell size={18} color={item.isRead ? 'var(--gray-400)' : 'var(--primary)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                    {!item.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
                  </div>
                  {item.message && <div style={{ color: 'var(--gray-600)', fontSize: 14 }}>{item.message}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gray-400)', fontSize: 12, marginTop: 6 }}>
                    <Clock3 size={12} /> {timeAgo(item.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}