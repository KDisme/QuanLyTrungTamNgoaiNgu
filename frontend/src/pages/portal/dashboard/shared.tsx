import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar, TrendingUp, BookOpen } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';

export function monthLabel(month: string) {
  const [y, m] = month.split('-');
  return `T${parseInt(m, 10)}/${y.slice(2)}`;
}

export function StatCard({ label, value, icon: Icon, tone = 'blue', sub }: any) {
  const colors: Record<string, { bg: string; fg: string }> = {
    blue: { bg: '#dbeafe', fg: '#2563eb' },
    green: { bg: '#d1fae5', fg: '#059669' },
    orange: { bg: '#fed7aa', fg: '#f97316' },
    purple: { bg: '#ddd6fe', fg: '#8b5cf6' },
    red: { bg: '#fecaca', fg: '#ef4444' },
  };
  const c = colors[tone] || colors.blue;
  return (
    <div className={`stat-card tone-${tone}`}>
      <div style={{ flex: 1 }}>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{sub}</div>}
      </div>
      <div className="stat-icon" style={{ background: c.bg }}><Icon size={22} color={c.fg} /></div>
    </div>
  );
}

export function QuickLink({ to, title, desc, icon: Icon }: any) {
  return (
    <Link to={to} className="portal-link-card">
      <div className="portal-link-icon"><Icon size={20} /></div>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{desc}</div>
      </div>
    </Link>
  );
}

export function EmptyPanel({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="empty-panel-v2">
      <div className="empty-panel-icon">
        <AlertCircle size={24} color="var(--gray-400)" />
      </div>
      <div style={{ fontWeight: 700, color: 'var(--gray-700)' }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 4, color: 'var(--gray-500)' }}>{desc}</div>
    </div>
  );
}

export function UpcomingBox({ upcoming }: { upcoming: any[] }) {
  return (
    <div className="card">
      <h3><Calendar size={16} color="var(--primary)" /> Lịch gần nhất</h3>
      {upcoming.length === 0 ? <EmptyPanel title="Chưa có lịch" desc="Không có buổi học gần nhất trong phạm vi quyền hiện tại." /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {upcoming.slice(0, 5).map((item: any, idx: number) => (
            <div key={item.id || idx} className="mini-list-row-v2">
              <div className="mini-list-icon" style={{ background: '#dbeafe' }}>
                <Calendar size={17} color="#2563eb" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{item.class_name || item.className || item.title || 'Buổi học'}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.room_name || item.teacher_name || 'Lịch học'}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                {item.session_date ? new Date(item.session_date).toLocaleDateString('vi-VN') : item.date || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewStudentsChart({ data }: { data: any[] | undefined }) {
  const chartData = (data || []).map((item) => ({ label: monthLabel(item.month), count: item.count }));
  return (
    <div className="card">
      <h3><TrendingUp size={16} color="var(--primary)" /> Học viên mới theo tháng</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có học viên nhập học trong 6 tháng qua." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Học viên mới" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function ClassTypeChart({ data }: { data: any[] | undefined }) {
  const LABELS: Record<string, string> = { fixed: 'Có thời hạn', open: 'Không thời hạn' };
  const COLORS: Record<string, string> = { fixed: '#2563eb', open: '#f59e0b' };
  const chartData = (data || []).map((item) => ({ name: LABELS[item.type] || item.type, value: item.count, color: COLORS[item.type] || '#94a3b8' }));
  return (
    <div className="card">
      <h3><BookOpen size={16} color="var(--primary)" /> Loại lớp học</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có lớp học nào đang hoạt động." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
              {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}