import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, ClipboardList, GraduationCap, Users, BadgeCheck, AlertCircle } from 'lucide-react';
import { dashboardApi, schedulesApi, mockExamsApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { getPrimaryRole, ROLE_LABELS, ROLE_PORTAL_NAMES } from '../../config/roleConfig';
import { Loading } from '../../components/common';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

function StatCard({ label, value, icon: Icon, tone = 'blue' }: any) {
  const colors: Record<string, { bg: string; fg: string }> = {
    blue: { bg: '#eff6ff', fg: '#2563eb' },
    green: { bg: '#ecfdf5', fg: '#059669' },
    orange: { bg: '#fff7ed', fg: '#f97316' },
    purple: { bg: '#f5f3ff', fg: '#8b5cf6' },
    red: { bg: '#fef2f2', fg: '#ef4444' },
  };
  const c = colors[tone] || colors.blue;
  return (
    <div className="stat-card">
      <div style={{ flex: 1 }}>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-icon" style={{ background: c.bg }}><Icon size={22} color={c.fg} /></div>
    </div>
  );
}

function QuickLink({ to, title, desc, icon: Icon }: any) {
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

function EmptyPanel({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 28, color: 'var(--gray-500)' }}>
      <AlertCircle size={24} style={{ marginBottom: 8 }} />
      <div style={{ fontWeight: 700, color: 'var(--gray-700)' }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>{desc}</div>
    </div>
  );
}

export default function RoleDashboard() {
  const { user, tenantSlug } = useAuth();
  const role = getPrimaryRole(user?.roles);
  const base = `/${tenantSlug}/${role}`;
  const [stats, setStats] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [mockExams, setMockExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      dashboardApi.getStats(),
      schedulesApi.getUpcoming({ limit: 5 }),
      (role === 'student' || role === 'teacher' || role === 'staff') ? mockExamsApi.getAll({ limit: 5 }) : Promise.resolve({ data: [] }),
    ]).then(([s, sch, exams]) => {
      if (!mounted) return;
      if (s.status === 'fulfilled') setStats(s.value.data);
      if (sch.status === 'fulfilled') setUpcoming(Array.isArray(sch.value.data) ? sch.value.data : sch.value.data?.data || []);
      if (exams.status === 'fulfilled') setMockExams(Array.isArray(exams.value.data) ? exams.value.data : exams.value.data?.data || []);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [role, user]);

  if (loading) return <Loading />;

  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div>
      <div className="portal-hero">
        <div>
          <div className="portal-eyebrow">{ROLE_PORTAL_NAMES[role]} · {ROLE_LABELS[role]}</div>
          <h1>Xin chào, {user?.fullName} 👋</h1>
          <p>{today}</p>
        </div>
        <div className={`portal-role-pill role-${role}`}>{ROLE_LABELS[role]}</div>
      </div>

      {role === 'admin' && (
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
            <TopClassesChart data={stats?.topClasses} />
            <NeedsAttentionPanel stats={stats} />
          </div>

          <div className="portal-grid-2" style={{ marginTop: 18 }}>
            <div className="card"><h3>Truy cập nhanh</h3><div className="portal-link-grid"><QuickLink to={`${base}/users`} title="Quản lý tài khoản" desc="Tạo, khóa, phân vai trò" icon={Users} /><QuickLink to={`${base}/classes`} title="Quản lý lớp" desc="Lớp, giáo viên, học viên" icon={BookOpen} /><QuickLink to={`${base}/mock-exams`} title="Thi thử" desc="Kỳ thi và kết quả" icon={ClipboardList} /></div></div>
            <UpcomingBox upcoming={upcoming} />
          </div>
        </>
      )}

      {role === 'staff' && (
        <>
          <div className="stats-grid">
            <StatCard label="Buổi học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} />
            <StatCard label="Lớp đang mở" value={stats?.activeClasses ?? 0} icon={BookOpen} tone="green" />
            <StatCard label="Học viên" value={stats?.students ?? 0} icon={Users} tone="purple" />
            <StatCard label="Kỳ thi thử" value={mockExams.length} icon={BadgeCheck} tone="orange" />
          </div>
          <div className="portal-grid-2">
            <div className="card"><h3>Công việc nhân viên</h3><div className="portal-link-grid"><QuickLink to={`${base}/students`} title="Tiếp nhận học viên" desc="Tạo và cập nhật hồ sơ" icon={UserCheckIcon} /><QuickLink to={`${base}/classes`} title="Ghi danh lớp" desc="Thêm học viên vào lớp" icon={BookOpen} /><QuickLink to={`${base}/mock-exams`} title="Kỳ thi thử" desc="Theo dõi ca thi" icon={ClipboardList} /></div></div>
            <UpcomingBox upcoming={upcoming} />
          </div>
        </>
      )}

      {role === 'teacher' && (
        <>
          <div className="stats-grid">
            <StatCard label="Lớp của tôi" value={stats?.activeClasses ?? 0} icon={BookOpen} />
            <StatCard label="Lịch dạy hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="green" />
            <StatCard label="Học viên phụ trách" value={stats?.students ?? 0} icon={Users} tone="purple" />
            <StatCard label="Bài thi cần xem" value={mockExams.length} icon={BadgeCheck} tone="orange" />
          </div>
          <div className="portal-grid-2">
            <div className="card"><h3>Công cụ giảng dạy</h3><div className="portal-link-grid"><QuickLink to={`${base}/my-classes`} title="Lớp của tôi" desc="Xem lớp đang dạy" icon={BookOpen} /><QuickLink to={`${base}/attendance`} title="Điểm danh" desc="Điểm danh theo buổi học" icon={ClipboardList} /><QuickLink to={`${base}/grading`} title="Chấm bài" desc="Thi thử được phân công" icon={BadgeCheck} /></div></div>
            <UpcomingBox upcoming={upcoming} />
          </div>
        </>
      )}

      {role === 'student' && (
        <>
          <div className="stats-grid">
            <StatCard label="Lớp đang học" value={stats?.activeClasses ?? 0} icon={BookOpen} />
            <StatCard label="Lịch học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="green" />
            <StatCard label="Bài thi thử" value={mockExams.length} icon={BadgeCheck} tone="purple" />
          </div>
          <div className="portal-grid-2">
            <div className="card"><h3>Khu vực học viên</h3><div className="portal-link-grid"><QuickLink to={`${base}/my-schedule`} title="Lịch học của tôi" desc="Xem buổi học sắp tới" icon={Calendar} /><QuickLink to={`${base}/mock-exams`} title="Thi thử" desc="Làm bài được giao" icon={ClipboardList} /></div></div>
            <UpcomingBox upcoming={upcoming} />
          </div>
        </>
      )}
    </div>
  );
}

function UserCheckIcon(props: any) { return <Users {...props} />; }

function UpcomingBox({ upcoming }: { upcoming: any[] }) {
  return (
    <div className="card">
      <h3>Lịch gần nhất</h3>
      {upcoming.length === 0 ? <EmptyPanel title="Chưa có lịch" desc="Không có buổi học gần nhất trong phạm vi quyền hiện tại." /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {upcoming.slice(0, 5).map((item: any, idx: number) => (
            <div key={item.id || idx} className="mini-list-row">
              <div>
                <strong>{item.class_name || item.className || item.title || 'Buổi học'}</strong>
                <div>{item.room_name || item.teacher_name || 'Lịch học'}</div>
              </div>
              <span>{item.session_date ? new Date(item.session_date).toLocaleDateString('vi-VN') : item.date || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: '#2563eb',
  paused: '#f59e0b',
  graduated: '#059669',
  dropped: '#ef4444',
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
    name: item.label,
    value: item.count,
    color: STATUS_COLORS[item.status] || '#94a3b8',
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

function NeedsAttentionPanel({ stats }: { stats: any }) {
  const items = [
    { label: 'Bài tập chờ chấm', value: stats?.pendingHomeworkGrading ?? 0, icon: ClipboardList },
    { label: 'Bài thi thử chờ chấm', value: stats?.pendingMockExamGrading ?? 0, icon: BadgeCheck },
  ].filter((item) => item.value > 0);

  return (
    <div className="card">
      <h3>Cần xử lý</h3>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--gray-500)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ecfdf5', display: 'grid', placeItems: 'center', margin: '0 auto 10px' }}>
            <BadgeCheck size={22} color="#059669" />
          </div>
          <div style={{ fontWeight: 700, color: 'var(--gray-700)' }}>Không có việc cần xử lý</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Tất cả bài tập và bài thi đã được chấm.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {items.map((item, idx) => (
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