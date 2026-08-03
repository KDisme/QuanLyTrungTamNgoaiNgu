import React from 'react';
import { BookOpen, Calendar, ClipboardList, GraduationCap, Users, BadgeCheck, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { StatCard, QuickLink, EmptyPanel, UpcomingBox, NewStudentsChart, ClassTypeChart } from './shared';

const STATUS_COLORS: Record<string, string> = {
  active: '#2563eb', paused: '#f59e0b', graduated: '#059669', dropped: '#ef4444',
};

function AttendanceWeeklyChart({ data }: { data: any[] | undefined }) {
  const chartData = (data || []).map((item) => ({
    label: new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'short' }),
    'Tỷ lệ (%)': item.rate,
  }));
  return (
    <div className="card">
      <h3>Tỷ lệ điểm danh theo tuần</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có dữ liệu điểm danh" desc="Chưa có buổi học nào được điểm danh trong 7 ngày qua." />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Bar dataKey="Tỷ lệ (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function StudentStatusChart({ data }: { data: any[] | undefined }) {
  const chartData = (data || []).map((item) => ({
    name: item.label, value: item.count, color: STATUS_COLORS[item.status] || '#94a3b8',
  }));
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="card">
      <h3>Phân bổ trạng thái học viên</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có học viên nào trong hệ thống." />
      ) : (
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={2}>
                {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{total}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700 }}>HỌC VIÊN</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopClassesChart({ data }: { data: any[] | undefined }) {
  const chartData = (data || []).map((item) => ({ name: item.name, count: item.count }));
  return (
    <div className="card">
      <h3>Top lớp đông nhất</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có lớp nào có học viên." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 50)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="name" fontSize={12} width={140} />
            <Tooltip />
            <Bar dataKey="count" fill="#059669" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function NeedsAttentionPanel({ items }: { items: { label: string; value: number; icon: any }[] }) {
  const visible = items.filter((item) => item.value > 0);
  return (
    <div className="card">
      <h3>Cần xử lý</h3>
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--gray-500)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ecfdf5', display: 'grid', placeItems: 'center', margin: '0 auto 10px' }}>
            <BadgeCheck size={22} color="#059669" />
          </div>
          <div style={{ fontWeight: 700, color: 'var(--gray-700)' }}>Không có việc cần xử lý</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Tất cả đã được cập nhật.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {visible.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--gray-200)', borderRadius: 12, background: '#fff7ed' }}>
              <item.icon size={20} color="#f97316" />
              <div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ stats, upcoming, base }: any) {
  return (
    <>
      <div className="stats-grid">
        <StatCard label="Học viên" value={stats?.students ?? 0} icon={Users} />
        <StatCard label="Lớp đang hoạt động" value={stats?.activeClasses ?? 0} icon={BookOpen} tone="green" />
        <StatCard label="Giáo viên" value={stats?.teachers ?? 0} icon={GraduationCap} tone="purple" />
        <StatCard label="Buổi học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="orange" />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <AttendanceWeeklyChart data={stats?.weeklyAttendance} />
        <StudentStatusChart data={stats?.studentStatusDistribution} />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <NewStudentsChart data={stats?.newStudentsByMonth} />
        <ClassTypeChart data={stats?.classTypeDistribution} />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <TopClassesChart data={stats?.topClasses} />
        <NeedsAttentionPanel
          items={[
            { label: 'Bài tập chờ chấm', value: stats?.pendingHomeworkGrading ?? 0, icon: ClipboardList },
            { label: 'Bài thi thử chờ chấm', value: stats?.pendingMockExamGrading ?? 0, icon: BadgeCheck },
          ]}
        />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Truy cập nhanh</h3>
          <div className="portal-link-grid">
            <QuickLink to={`${base}/users`} title="Quản lý tài khoản" desc="Tạo, khóa, phân vai trò" icon={Users} />
            <QuickLink to={`${base}/classes`} title="Quản lý lớp" desc="Lớp, giáo viên, học viên" icon={BookOpen} />
            <QuickLink to={`${base}/mock-exams`} title="Thi thử" desc="Kỳ thi và kết quả" icon={ClipboardList} />
            <QuickLink to={`${base}/activity-logs`} title="Lịch sử hoạt động" desc="Theo dõi hành động trong hệ thống" icon={FileText} />
          </div>
        </div>
        <UpcomingBox upcoming={upcoming} />
      </div>
    </>
  );
}