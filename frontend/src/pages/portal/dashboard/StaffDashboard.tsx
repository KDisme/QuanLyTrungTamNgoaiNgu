import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, BookOpen, Users, BadgeCheck, ClipboardList } from 'lucide-react';
import { StatCard, QuickLink, EmptyPanel, UpcomingBox, NewStudentsChart, ClassTypeChart } from './shared';

function MockExamListCard({ mockExams, base, title }: { mockExams: any[]; base: string; title: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {mockExams.length === 0 ? (
        <EmptyPanel title="Chưa có kỳ thi thử" desc="Chưa có kỳ thi thử nào gần đây." />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Tên kỳ thi</th><th>Lớp</th><th>Số học viên</th><th></th></tr>
            </thead>
            <tbody>
              {mockExams.slice(0, 5).map((m: any) => (
                <tr key={m.id}>
                  <td><strong>{m.title}</strong></td>
                  <td>{m.class_name || m.className || '—'}</td>
                  <td>{m.student_count ?? '—'}</td>
                  <td><Link to={`${base}/mock-exams`} style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 700 }}>Xem</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function StaffDashboard({ stats, upcoming, mockExams, base }: any) {
  return (
    <>
      <div className="stats-grid">
        <StatCard label="Buổi học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} />
        <StatCard label="Lớp đang mở" value={stats?.activeClasses ?? 0} icon={BookOpen} tone="green" />
        <StatCard label="Học viên" value={stats?.students ?? 0} icon={Users} tone="purple" />
        <StatCard label="Kỳ thi thử" value={mockExams.length} icon={BadgeCheck} tone="orange" />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Công việc nhân viên</h3>
          <div className="portal-link-grid">
            <QuickLink to={`${base}/students`} title="Tiếp nhận học viên" desc="Tạo và cập nhật hồ sơ" icon={Users} />
            <QuickLink to={`${base}/classes`} title="Ghi danh lớp" desc="Thêm học viên vào lớp" icon={BookOpen} />
            <QuickLink to={`${base}/mock-exams`} title="Kỳ thi thử" desc="Theo dõi ca thi" icon={ClipboardList} />
            <QuickLink to={`${base}/attendance`} title="Điểm danh" desc="Theo dõi điểm danh lớp học" icon={ClipboardList} />
          </div>
        </div>
        <UpcomingBox upcoming={upcoming} />
      </div>

      <div className="portal-grid-2" style={{ marginTop: 18 }}>
        <NewStudentsChart data={stats?.newStudentsByMonth} />
        <ClassTypeChart data={stats?.classTypeDistribution} />
      </div>

      <div style={{ marginTop: 18 }}>
        <MockExamListCard mockExams={mockExams} base={base} title="Kỳ thi thử gần đây" />
      </div>
    </>
  );
}