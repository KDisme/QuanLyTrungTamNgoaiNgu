import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Users, BadgeCheck, ClipboardList, FileText, Clock3, ArrowRight, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { StatCard, QuickLink, EmptyPanel, UpcomingBox } from './shared';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function WeekScheduleCard({ schedule }: { schedule: any[] | undefined }) {
  return (
    <div className="card">
      <h3>Lịch dạy 7 ngày tới</h3>
      {!schedule || schedule.length === 0 ? (
        <EmptyPanel title="Chưa có lịch dạy sắp tới" desc="Bạn chưa có buổi dạy nào trong 7 ngày tới." />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {schedule.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--gray-100)', borderRadius: 10, background: 'var(--gray-50)' }}>
              <div style={{
                width: 44, textAlign: 'center', flex: 'none', fontWeight: 800, fontSize: 13,
                color: 'var(--primary)', background: '#eff6ff', borderRadius: 8, padding: '4px 0',
              }}>
                {formatDate(item.date)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{item.className}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <Clock3 size={12} /> {item.startTime?.slice(0, 5)}–{item.endTime?.slice(0, 5)}
                  {item.roomName && <span>· {item.roomName}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyHomeworksCard({ homeworks, base }: { homeworks: any[] | undefined; base: string }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3>Bài tập tôi đã giao</h3>
        <Link to={`${base}/homework`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Xem tất cả <ArrowRight size={12} />
        </Link>
      </div>
      {!homeworks || homeworks.length === 0 ? (
        <EmptyPanel title="Chưa có bài tập nào" desc="Bạn chưa giao bài tập về nhà nào đang mở." />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {homeworks.map((item) => (
            <div key={item.id} className="mini-list-row">
              <div>
                <strong>{item.title}</strong>
                <div>{item.classNames || 'Chưa gán lớp'}</div>
              </div>
              <span style={{ color: item.pendingCount > 0 ? 'var(--orange)' : 'var(--gray-400)', fontWeight: 700 }}>
                {item.pendingCount > 0 ? `${item.pendingCount} chờ chấm` : 'Đã chấm hết'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherAttendanceChart({ data }: { data: any[] | undefined }) {
  const chartData = (data || []).map((item) => ({
    label: new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'short' }),
    'Tỷ lệ (%)': item.rate,
  }));
  return (
    <div className="card">
      <h3><TrendingUp size={16} color="var(--primary)" /> Điểm danh lớp tôi dạy (7 ngày)</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có buổi học nào của bạn được điểm danh gần đây." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Bar dataKey="Tỷ lệ (%)" fill="#059669" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function GradingProgressChart({ progress }: { progress: { graded: number; pending: number } | undefined }) {
  const graded = progress?.graded || 0;
  const pending = progress?.pending || 0;
  const total = graded + pending;
  const chartData = [
    { name: 'Đã chấm', value: graded, color: '#059669' },
    { name: 'Chờ chấm', value: pending, color: '#f97316' },
  ];
  return (
    <div className="card">
      <h3><BadgeCheck size={16} color="var(--primary)" /> Tiến độ chấm bài</h3>
      {total === 0 ? (
        <EmptyPanel title="Chưa có bài nộp nào" desc="Chưa có học viên nào nộp bài tập của bạn." />
      ) : (
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '36%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{Math.round((graded / total) * 100)}%</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherDashboard({ stats, upcoming, base }: any) {
  return (
    <>
      <div className="stats-grid">
        <StatCard label="Lớp của tôi" value={stats?.activeClasses ?? 0} icon={BookOpen} />
        <StatCard label="Lịch dạy hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="green" />
        <StatCard label="Học viên phụ trách" value={stats?.students ?? 0} icon={Users} tone="purple" />
        <StatCard
          label="Cần chấm bài"
          value={(stats?.pendingHomeworkGrading ?? 0) + (stats?.pendingMockExamGrading ?? 0)}
          icon={BadgeCheck}
          tone="orange"
          sub={`${stats?.pendingHomeworkGrading ?? 0} bài tập · ${stats?.pendingMockExamGrading ?? 0} thi thử`}
        />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <WeekScheduleCard schedule={stats?.weekSchedule} />
        <MyHomeworksCard homeworks={stats?.myHomeworks} base={base} />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <TeacherAttendanceChart data={stats?.weeklyAttendance} />
        <GradingProgressChart progress={stats?.gradingProgress} />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Công cụ giảng dạy</h3>
          <div className="portal-link-grid">
            <QuickLink to={`${base}/my-classes`} title="Lớp của tôi" desc="Xem lớp đang dạy" icon={BookOpen} />
            <QuickLink to={`${base}/attendance`} title="Điểm danh" desc="Điểm danh theo buổi học" icon={ClipboardList} />
            <QuickLink to={`${base}/grading`} title="Chấm bài" desc="Thi thử được phân công" icon={BadgeCheck} />
            <QuickLink to={`${base}/homework`} title="Bài tập về nhà" desc="Giao và chấm bài tập" icon={FileText} />
          </div>
        </div>
        <UpcomingBox upcoming={upcoming} />
      </div>
    </>
  );
}