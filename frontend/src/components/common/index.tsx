import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

// ---- MODAL ----
interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : ''}`}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ---- TABS ----
interface Tab { id: string; label: string; icon?: ReactNode; count?: number }
interface TabsProps { tabs: Tab[]; active: string; onChange: (id: string) => void }

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="tabs">
      {tabs.map(tab => (
        <button key={tab.id} className={`tab${active === tab.id ? ' active' : ''}`} onClick={() => onChange(tab.id)}>
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span style={{
              background: active === tab.id ? 'var(--primary)' : 'var(--gray-200)',
              color: active === tab.id ? 'white' : 'var(--gray-600)',
              borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700
            }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---- BADGE ----
type BadgeVariant = 'blue' | 'green' | 'yellow' | 'red' | 'orange' | 'gray' | 'purple';
interface BadgeProps { children: ReactNode; variant?: BadgeVariant }

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// ---- AVATAR ----
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
function getColor(name: string) {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}
function getInitials(name: string) { return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase(); }

interface AvatarProps { name: string; size?: number }
export function Avatar({ name, size = 36 }: AvatarProps) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: getColor(name), fontSize: size * 0.36 }}>
      {getInitials(name)}
    </div>
  );
}

// ---- STATUS BADGE ----
const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Đang mở / hoạt động', variant: 'green' },
  inactive: { label: 'Không hoạt động', variant: 'gray' },
  upcoming: { label: 'Sắp diễn ra', variant: 'yellow' },
  closed: { label: 'Đã đóng', variant: 'gray' },
  completed: { label: 'Đã hoàn thành', variant: 'blue' },
  cancelled: { label: 'Đã huỷ', variant: 'red' },
  scheduled: { label: 'Đã lên lịch', variant: 'blue' },
  postponed: { label: 'Dời lịch', variant: 'orange' },
  draft: { label: 'Nháp', variant: 'gray' },
  paid: { label: 'Đã thu', variant: 'green' },
  partial: { label: 'Thu một phần', variant: 'yellow' },
  pending: { label: 'Chưa thu', variant: 'red' },
  fixed: { label: 'Có thời hạn', variant: 'blue' },
  open: { label: 'Không thời hạn', variant: 'purple' },
  present: { label: 'Có mặt', variant: 'green' },
  absent: { label: 'Vắng', variant: 'red' },
  late: { label: 'Trễ', variant: 'yellow' },
  assigned: { label: 'Được giao', variant: 'blue' },
  in_progress: { label: 'Đang làm', variant: 'yellow' },
  submitted: { label: 'Đã nộp', variant: 'green' },
  graded: { label: 'Đã chấm', variant: 'purple' },
  suspended: { label: 'Tạm dừng', variant: 'orange' },
  dropped: { label: 'Bỏ học', variant: 'red' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, variant: 'gray' as BadgeVariant };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// ---- EMPTY STATE ----
export function EmptyState({ message = 'Chưa có dữ liệu' }: { message?: string }) {
  return (
    <div className="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#f3f4f6"/>
        <path d="M16 32V20a2 2 0 012-2h12a2 2 0 012 2v12M12 32h24" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <p>{message}</p>
    </div>
  );
}

// ---- LOADING ----
export function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--gray-200)',
        borderTop: '3px solid var(--primary)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ---- CONFIRM DIALOG ----
interface ConfirmProps { message: string; onConfirm: () => void; onCancel: () => void }
export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal title="Xác nhận" onClose={onCancel} footer={
      <>
        <button className="btn btn-secondary" onClick={onCancel}>Huỷ</button>
        <button className="btn btn-danger" onClick={onConfirm}>Xác nhận</button>
      </>
    }>
      <p style={{ color: 'var(--gray-700)', fontSize: 14 }}>{message}</p>
    </Modal>
  );
}
