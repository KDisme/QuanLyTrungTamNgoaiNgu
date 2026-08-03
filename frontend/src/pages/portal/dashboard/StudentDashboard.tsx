import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, FileText, BadgeCheck, ClipboardList, CheckCircle2, ArrowRight, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { StatCard, QuickLink, EmptyPanel, UpcomingBox, monthLabel } from './shared';

function UpcomingHomeworkCard({ homework, base }: { homework: any[] | undefined; base: string }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3>Bài tập sắp đến hạn</h3>
        <Link to={`${base}/homework`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Xem tất cả <ArrowRight size={12} />
        </Link>
      </div>
      {!homework || homework.length === 0 ? (
        <EmptyPanel title="Không có bài tập nào" desc="Bạn đã hoàn thành hết bài tập được giao." />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {homework.map((item) => {
            const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
            return (
              <div key={item.id} className="mini-list-row">
                <div>
                  <strong>{item.title}</strong>
                  <div>{item.classNames || 'Chưa gán lớp'}</div>
                </div>
                <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--gray-500)', fontWeight: 700 }}>
                  {item.dueDate ? new Date(item.dueDate).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Không hạn'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttendanceRateCard({ rate, present, total }: { rate: number | null; present?: number; total?: number }) {
  return (
    <div className="card">
      <h3>Tỷ lệ điểm danh</h3>
      {rate === null || rate === undefined ? (
        <EmptyPanel title="Chưa có dữ liệu điểm danh" desc="Chưa có buổi học nào được điểm danh." />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', width: 120, height: 120, flex: 'none' }}>
            <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gray-100)" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke={rate >= 80 ? '#059669' : rate >= 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="12" strokeDasharray={`${(rate / 100) * 327} 327`} strokeLinecap="round"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 22 }}>{rate}%</div>
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
              Có mặt <strong>{present ?? 0}</strong> / <strong>{total ?? 0}</strong> buổi học
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} /> Tính trên toàn bộ lịch sử điểm danh
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentScoresChart({ data }: { data: any[] | undefined }) {
  const chartData = (data || []).slice().reverse().map((item) => ({
    label: item.title.length > 12 ? `${item.title.slice(0, 12)}…` : item.title,
    percent: item.maxScore > 0 ? Math.round((item.score / item.maxScore) * 100) : 0,
  }));
  return (
    <div className="card">
      <h3><FileText size={16} color="var(--orange)" /> Điểm các bài tập gần đây</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có bài nào được chấm" desc="Khi giáo viên chấm bài, kết quả sẽ hiện ở đây." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis fontSize={12} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Bar dataKey="percent" name="Điểm (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function MonthlyAttendanceChart({ data }: { data: any[] | undefined }) {
  const chartData = (data || []).map((item) => ({ label: monthLabel(item.month), 'Tỷ lệ (%)': item.rate }));
  return (
    <div className="card">
      <h3><TrendingUp size={16} color="var(--primary)" /> Điểm danh theo tháng</h3>
      {chartData.length === 0 ? (
        <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có buổi học nào được điểm danh." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Bar dataKey="Tỷ lệ (%)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function StudentDashboard({ stats, upcoming, base }: any) {
  const attendanceRate = stats?.attendanceRate;
  return (
    <>
      <div className="stats-grid">
        <StatCard label="Lớp đang học" value={stats?.activeClasses ?? 0} icon={BookOpen} />
        <StatCard label="Lịch học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="green" />
        <StatCard label="Bài tập cần làm" value={stats?.pendingHomeworkCount ?? 0} icon={FileText} tone="orange" />
        <StatCard label="Bài thi thử sắp tới" value={stats?.upcomingMockExamCount ?? 0} icon={BadgeCheck} tone="purple" />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <UpcomingHomeworkCard homework={stats?.upcomingHomework} base={base} />
        <AttendanceRateCard rate={attendanceRate} present={stats?.attendancePresent} total={stats?.attendanceTotal} />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <RecentScoresChart data={stats?.recentScores} />
        <MonthlyAttendanceChart data={stats?.monthlyAttendance} />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Khu vực học viên</h3>
          <div className="portal-link-grid">
            <QuickLink to={`${base}/my-schedule`} title="Lịch học của tôi" desc="Xem buổi học sắp tới" icon={Calendar} />
            <QuickLink to={`${base}/mock-exams`} title="Thi thử" desc="Làm bài được giao" icon={ClipboardList} />
            <QuickLink to={`${base}/homework`} title="Bài tập về nhà" desc="Xem và nộp bài tập" icon={FileText} />
            <QuickLink to={`${base}/my-attendance`} title="Điểm danh của tôi" desc="Theo dõi lịch sử điểm danh" icon={CheckCircle2} />
          </div>
        </div>
        <UpcomingBox upcoming={upcoming} />
      </div>
    </>
  );
}