import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getPrimaryRole, ROLE_LABELS, ROLE_PORTAL_NAMES } from '../../config/roleConfig';
import { Loading } from '../../components/common';
import { useDashboardData } from './dashboard/useDashboardData';
import AdminDashboard from './dashboard/AdminDashboard';
import StaffDashboard from './dashboard/StaffDashboard';
import TeacherDashboard from './dashboard/TeacherDashboard';
import StudentDashboard from './dashboard/StudentDashboard';

export default function RoleDashboard() {
  const { user, tenantSlug } = useAuth();
  const role = getPrimaryRole(user?.roles);
  const base = `/${tenantSlug}/${role}`;
  const { stats, upcoming, mockExams, loading } = useDashboardData(role, user);

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

      {role === 'admin' && <AdminDashboard stats={stats} upcoming={upcoming} base={base} />}
      {role === 'staff' && <StaffDashboard stats={stats} upcoming={upcoming} mockExams={mockExams} base={base} />}
      {role === 'teacher' && <TeacherDashboard stats={stats} upcoming={upcoming} base={base} />}
      {role === 'student' && <StudentDashboard stats={stats} upcoming={upcoming} base={base} />}
    </div>
  );
}

// import React, { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom';
// import {
//   BookOpen, Calendar, ClipboardList, GraduationCap, Users, BadgeCheck, AlertCircle,
//   Clock3, CheckCircle2, TrendingUp, FileText, ArrowRight,
// } from 'lucide-react';
// import { dashboardApi, schedulesApi, mockExamsApi } from '../../api';
// import { useAuth } from '../../hooks/useAuth';
// import { getPrimaryRole, ROLE_LABELS, ROLE_PORTAL_NAMES } from '../../config/roleConfig';
// import { Loading } from '../../components/common';
// import {
//   ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
//   PieChart, Pie, Cell, Legend,
// } from 'recharts';

// function StatCard({ label, value, icon: Icon, tone = 'blue', sub }: any) {
//   const colors: Record<string, { bg: string; fg: string }> = {
//     blue: { bg: '#dbeafe', fg: '#2563eb' },
//     green: { bg: '#d1fae5', fg: '#059669' },
//     orange: { bg: '#fed7aa', fg: '#f97316' },
//     purple: { bg: '#ddd6fe', fg: '#8b5cf6' },
//     red: { bg: '#fecaca', fg: '#ef4444' },
//   };
//   const c = colors[tone] || colors.blue;
//   return (
//     <div className={`stat-card tone-${tone}`}>
//       <div style={{ flex: 1 }}>
//         <div className="stat-value">{value}</div>
//         <div className="stat-label">{label}</div>
//         {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{sub}</div>}
//       </div>
//       <div className="stat-icon" style={{ background: c.bg }}><Icon size={22} color={c.fg} /></div>
//     </div>
//   );
// }

// function QuickLink({ to, title, desc, icon: Icon }: any) {
//   return (
//     <Link to={to} className="portal-link-card">
//       <div className="portal-link-icon"><Icon size={20} /></div>
//       <div>
//         <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{title}</div>
//         <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{desc}</div>
//       </div>
//     </Link>
//   );
// }

// function EmptyPanel({ title, desc }: { title: string; desc: string }) {
//   return (
//     <div className="empty-panel-v2">
//       <div className="empty-panel-icon">
//         <AlertCircle size={24} color="var(--gray-400)" />
//       </div>
//       <div style={{ fontWeight: 700, color: 'var(--gray-700)' }}>{title}</div>
//       <div style={{ fontSize: 13, marginTop: 4, color: 'var(--gray-500)' }}>{desc}</div>
//     </div>
//   );
// }

// function formatDate(value: string | null | undefined) {
//   if (!value) return '—';
//   const d = new Date(value);
//   if (isNaN(d.getTime())) return '—';
//   const pad = (n: number) => String(n).padStart(2, '0');
//   return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
// }

// export default function RoleDashboard() {
//   const { user, tenantSlug } = useAuth();
//   const role = getPrimaryRole(user?.roles);
//   const base = `/${tenantSlug}/${role}`;
//   const [stats, setStats] = useState<any>(null);
//   const [upcoming, setUpcoming] = useState<any[]>([]);
//   const [mockExams, setMockExams] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     let mounted = true;
//     Promise.allSettled([
//       dashboardApi.getStats(),
//       schedulesApi.getUpcoming({ limit: 5 }),
//       (role === 'student' || role === 'teacher' || role === 'staff') ? mockExamsApi.getAll({ limit: 5 }) : Promise.resolve({ data: [] }),
//     ]).then(([s, sch, exams]) => {
//       if (!mounted) return;
//       if (s.status === 'fulfilled') setStats(s.value.data);
//       if (sch.status === 'fulfilled') setUpcoming(Array.isArray(sch.value.data) ? sch.value.data : sch.value.data?.data || []);
//       if (exams.status === 'fulfilled') setMockExams(Array.isArray(exams.value.data) ? exams.value.data : exams.value.data?.data || []);
//     }).finally(() => mounted && setLoading(false));
//     return () => { mounted = false; };
//   }, [role, user]);

//   if (loading) return <Loading />;

//   const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

//   return (
//     <div>
//       <div className="portal-hero">
//         <div>
//           <div className="portal-eyebrow">{ROLE_PORTAL_NAMES[role]} · {ROLE_LABELS[role]}</div>
//           <h1>Xin chào, {user?.fullName} 👋</h1>
//           <p>{today}</p>
//         </div>
//         <div className={`portal-role-pill role-${role}`}>{ROLE_LABELS[role]}</div>
//       </div>

//       {role === 'admin' && <AdminDashboard stats={stats} upcoming={upcoming} base={base} />}
//       {role === 'staff' && <StaffDashboard stats={stats} upcoming={upcoming} mockExams={mockExams} base={base} />}
//       {role === 'teacher' && <TeacherDashboard stats={stats} upcoming={upcoming} base={base} />}
//       {role === 'student' && <StudentDashboard stats={stats} upcoming={upcoming} base={base} />}
//     </div>
//   );
// }

// /* ---------------- ADMIN ---------------- */

// const STATUS_COLORS: Record<string, string> = {
//   active: '#2563eb', paused: '#f59e0b', graduated: '#059669', dropped: '#ef4444',
// };

// function AdminDashboard({ stats, upcoming, base }: any) {
//   return (
//     <>
//       <div className="stats-grid">
//         <StatCard label="Học viên" value={stats?.students ?? 0} icon={Users} />
//         <StatCard label="Lớp đang hoạt động" value={stats?.activeClasses ?? 0} icon={BookOpen} tone="green" />
//         <StatCard label="Giáo viên" value={stats?.teachers ?? 0} icon={GraduationCap} tone="purple" />
//         <StatCard label="Buổi học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="orange" />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <AttendanceWeeklyChart data={stats?.weeklyAttendance} />
//         <StudentStatusChart data={stats?.studentStatusDistribution} />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <NewStudentsChart data={stats?.newStudentsByMonth} />
//         <ClassTypeChart data={stats?.classTypeDistribution} />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <TopClassesChart data={stats?.topClasses} />
//         <NeedsAttentionPanel
//           items={[
//             { label: 'Bài tập chờ chấm', value: stats?.pendingHomeworkGrading ?? 0, icon: ClipboardList },
//             { label: 'Bài thi thử chờ chấm', value: stats?.pendingMockExamGrading ?? 0, icon: BadgeCheck },
//           ]}
//         />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <div className="card">
//           <h3>Truy cập nhanh</h3>
//           <div className="portal-link-grid">
//             <QuickLink to={`${base}/users`} title="Quản lý tài khoản" desc="Tạo, khóa, phân vai trò" icon={Users} />
//             <QuickLink to={`${base}/classes`} title="Quản lý lớp" desc="Lớp, giáo viên, học viên" icon={BookOpen} />
//             <QuickLink to={`${base}/mock-exams`} title="Thi thử" desc="Kỳ thi và kết quả" icon={ClipboardList} />
//             <QuickLink to={`${base}/activity-logs`} title="Lịch sử hoạt động" desc="Theo dõi hành động trong hệ thống" icon={FileText} />
//           </div>
//         </div>
//         <UpcomingBox upcoming={upcoming} />
//       </div>
//     </>
//   );
// }

// function AttendanceWeeklyChart({ data }: { data: any[] | undefined }) {
//   const chartData = (data || []).map((item) => ({
//     label: new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'short' }),
//     'Tỷ lệ (%)': item.rate,
//   }));
//   return (
//     <div className="card">
//       <h3>Tỷ lệ điểm danh theo tuần</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có dữ liệu điểm danh" desc="Chưa có buổi học nào được điểm danh trong 7 ngày qua." />
//       ) : (
//         <ResponsiveContainer width="100%" height={260}>
//           <BarChart data={chartData}>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />
//             <XAxis dataKey="label" fontSize={12} />
//             <YAxis fontSize={12} domain={[0, 100]} unit="%" />
//             <Tooltip formatter={(v: any) => `${v}%`} />
//             <Bar dataKey="Tỷ lệ (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       )}
//     </div>
//   );
// }

// function StudentStatusChart({ data }: { data: any[] | undefined }) {
//   const chartData = (data || []).map((item) => ({
//     name: item.label, value: item.count, color: STATUS_COLORS[item.status] || '#94a3b8',
//   }));
//   const total = chartData.reduce((sum, item) => sum + item.value, 0);
//   return (
//     <div className="card">
//       <h3>Phân bổ trạng thái học viên</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có học viên nào trong hệ thống." />
//       ) : (
//         <div style={{ position: 'relative' }}>
//           <ResponsiveContainer width="100%" height={260}>
//             <PieChart>
//               <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={2}>
//                 {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
//               </Pie>
//               <Tooltip />
//               <Legend />
//             </PieChart>
//           </ResponsiveContainer>
//           <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
//             <div style={{ fontWeight: 800, fontSize: 22 }}>{total}</div>
//             <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700 }}>HỌC VIÊN</div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// function TopClassesChart({ data }: { data: any[] | undefined }) {
//   const chartData = (data || []).map((item) => ({ name: item.name, count: item.count }));
//   return (
//     <div className="card">
//       <h3>Top lớp đông nhất</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có lớp nào có học viên." />
//       ) : (
//         <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 50)}>
//           <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
//             <CartesianGrid strokeDasharray="3 3" horizontal={false} />
//             <XAxis type="number" fontSize={12} allowDecimals={false} />
//             <YAxis type="category" dataKey="name" fontSize={12} width={140} />
//             <Tooltip />
//             <Bar dataKey="count" fill="#059669" radius={[0, 6, 6, 0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       )}
//     </div>
//   );
// }

// function NeedsAttentionPanel({ items }: { items: { label: string; value: number; icon: any }[] }) {
//   const visible = items.filter((item) => item.value > 0);
//   return (
//     <div className="card">
//       <h3>Cần xử lý</h3>
//       {visible.length === 0 ? (
//         <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--gray-500)' }}>
//           <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ecfdf5', display: 'grid', placeItems: 'center', margin: '0 auto 10px' }}>
//             <BadgeCheck size={22} color="#059669" />
//           </div>
//           <div style={{ fontWeight: 700, color: 'var(--gray-700)' }}>Không có việc cần xử lý</div>
//           <div style={{ fontSize: 13, marginTop: 4 }}>Tất cả đã được cập nhật.</div>
//         </div>
//       ) : (
//         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
//           {visible.map((item, idx) => (
//             <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--gray-200)', borderRadius: 12, background: '#fff7ed' }}>
//               <item.icon size={20} color="#f97316" />
//               <div>
//                 <div style={{ fontWeight: 800, fontSize: 20 }}>{item.value}</div>
//                 <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.label}</div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// function UpcomingBox({ upcoming }: { upcoming: any[] }) {
//   return (
//     <div className="card">
//       <h3><Calendar size={16} color="var(--primary)" /> Lịch gần nhất</h3>
//       {upcoming.length === 0 ? <EmptyPanel title="Chưa có lịch" desc="Không có buổi học gần nhất trong phạm vi quyền hiện tại." /> : (
//         <div style={{ display: 'grid', gap: 10 }}>
//           {upcoming.slice(0, 5).map((item: any, idx: number) => (
//             <div key={item.id || idx} className="mini-list-row-v2">
//               <div className="mini-list-icon" style={{ background: '#dbeafe' }}>
//                 <Calendar size={17} color="#2563eb" />
//               </div>
//               <div style={{ flex: 1 }}>
//                 <div style={{ fontWeight: 700, fontSize: 13 }}>{item.class_name || item.className || item.title || 'Buổi học'}</div>
//                 <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.room_name || item.teacher_name || 'Lịch học'}</div>
//               </div>
//               <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
//                 {item.session_date ? new Date(item.session_date).toLocaleDateString('vi-VN') : item.date || ''}
//               </span>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// /* ---------------- STAFF ---------------- */

// function StaffDashboard({ stats, upcoming, mockExams, base }: any) {
//   return (
//     <>
//       <div className="stats-grid">
//         <StatCard label="Buổi học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} />
//         <StatCard label="Lớp đang mở" value={stats?.activeClasses ?? 0} icon={BookOpen} tone="green" />
//         <StatCard label="Học viên" value={stats?.students ?? 0} icon={Users} tone="purple" />
//         <StatCard label="Kỳ thi thử" value={mockExams.length} icon={BadgeCheck} tone="orange" />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <div className="card">
//           <h3>Công việc nhân viên</h3>
//           <div className="portal-link-grid">
//             <QuickLink to={`${base}/students`} title="Tiếp nhận học viên" desc="Tạo và cập nhật hồ sơ" icon={Users} />
//             <QuickLink to={`${base}/classes`} title="Ghi danh lớp" desc="Thêm học viên vào lớp" icon={BookOpen} />
//             <QuickLink to={`${base}/mock-exams`} title="Kỳ thi thử" desc="Theo dõi ca thi" icon={ClipboardList} />
//             <QuickLink to={`${base}/attendance`} title="Điểm danh" desc="Theo dõi điểm danh lớp học" icon={ClipboardList} />
//           </div>
//         </div>
//         <UpcomingBox upcoming={upcoming} />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <NewStudentsChart data={stats?.newStudentsByMonth} />
//         <ClassTypeChart data={stats?.classTypeDistribution} />
//       </div>

//       <div style={{ marginTop: 18 }}>
//         <MockExamListCard mockExams={mockExams} base={base} title="Kỳ thi thử gần đây" />
//       </div>
//     </>
//   );
// }

// /* ---------------- TEACHER ---------------- */

// function TeacherDashboard({ stats, upcoming, base }: any) {
//   return (
//     <>
//       <div className="stats-grid">
//         <StatCard label="Lớp của tôi" value={stats?.activeClasses ?? 0} icon={BookOpen} />
//         <StatCard label="Lịch dạy hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="green" />
//         <StatCard label="Học viên phụ trách" value={stats?.students ?? 0} icon={Users} tone="purple" />
//         <StatCard
//           label="Cần chấm bài"
//           value={(stats?.pendingHomeworkGrading ?? 0) + (stats?.pendingMockExamGrading ?? 0)}
//           icon={BadgeCheck}
//           tone="orange"
//           sub={`${stats?.pendingHomeworkGrading ?? 0} bài tập · ${stats?.pendingMockExamGrading ?? 0} thi thử`}
//         />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <WeekScheduleCard schedule={stats?.weekSchedule} />
//         <MyHomeworksCard homeworks={stats?.myHomeworks} base={base} />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <TeacherAttendanceChart data={stats?.weeklyAttendance} />
//         <GradingProgressChart progress={stats?.gradingProgress} />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <div className="card">
//           <h3>Công cụ giảng dạy</h3>
//           <div className="portal-link-grid">
//             <QuickLink to={`${base}/my-classes`} title="Lớp của tôi" desc="Xem lớp đang dạy" icon={BookOpen} />
//             <QuickLink to={`${base}/attendance`} title="Điểm danh" desc="Điểm danh theo buổi học" icon={ClipboardList} />
//             <QuickLink to={`${base}/grading`} title="Chấm bài" desc="Thi thử được phân công" icon={BadgeCheck} />
//             <QuickLink to={`${base}/homework`} title="Bài tập về nhà" desc="Giao và chấm bài tập" icon={FileText} />
//           </div>
//         </div>
//         <UpcomingBox upcoming={upcoming} />
//       </div>
//     </>
//   );
// }

// function WeekScheduleCard({ schedule }: { schedule: any[] | undefined }) {
//   return (
//     <div className="card">
//       <h3>Lịch dạy 7 ngày tới</h3>
//       {!schedule || schedule.length === 0 ? (
//         <EmptyPanel title="Chưa có lịch dạy sắp tới" desc="Bạn chưa có buổi dạy nào trong 7 ngày tới." />
//       ) : (
//         <div style={{ display: 'grid', gap: 8 }}>
//           {schedule.map((item, idx) => (
//             <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--gray-100)', borderRadius: 10, background: 'var(--gray-50)' }}>
//               <div style={{
//                 width: 44, textAlign: 'center', flex: 'none', fontWeight: 800, fontSize: 13,
//                 color: 'var(--primary)', background: '#eff6ff', borderRadius: 8, padding: '4px 0',
//               }}>
//                 {formatDate(item.date)}
//               </div>
//               <div style={{ flex: 1 }}>
//                 <div style={{ fontWeight: 700, fontSize: 13 }}>{item.className}</div>
//                 <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
//                   <Clock3 size={12} /> {item.startTime?.slice(0, 5)}–{item.endTime?.slice(0, 5)}
//                   {item.roomName && <span>· {item.roomName}</span>}
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// function MyHomeworksCard({ homeworks, base }: { homeworks: any[] | undefined; base: string }) {
//   return (
//     <div className="card">
//       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//         <h3>Bài tập tôi đã giao</h3>
//         <Link to={`${base}/homework`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
//           Xem tất cả <ArrowRight size={12} />
//         </Link>
//       </div>
//       {!homeworks || homeworks.length === 0 ? (
//         <EmptyPanel title="Chưa có bài tập nào" desc="Bạn chưa giao bài tập về nhà nào đang mở." />
//       ) : (
//         <div style={{ display: 'grid', gap: 8 }}>
//           {homeworks.map((item) => (
//             <div key={item.id} className="mini-list-row">
//               <div>
//                 <strong>{item.title}</strong>
//                 <div>{item.classNames || 'Chưa gán lớp'}</div>
//               </div>
//               <span style={{ color: item.pendingCount > 0 ? 'var(--orange)' : 'var(--gray-400)', fontWeight: 700 }}>
//                 {item.pendingCount > 0 ? `${item.pendingCount} chờ chấm` : 'Đã chấm hết'}
//               </span>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// function MockExamListCard({ mockExams, base, title }: { mockExams: any[]; base: string; title: string }) {
//   return (
//     <div className="card">
//       <h3>{title}</h3>
//       {mockExams.length === 0 ? (
//         <EmptyPanel title="Chưa có kỳ thi thử" desc="Chưa có kỳ thi thử nào gần đây." />
//       ) : (
//         <div className="table-container">
//           <table>
//             <thead>
//               <tr><th>Tên kỳ thi</th><th>Lớp</th><th>Số học viên</th><th></th></tr>
//             </thead>
//             <tbody>
//               {mockExams.slice(0, 5).map((m: any) => (
//                 <tr key={m.id}>
//                   <td><strong>{m.title}</strong></td>
//                   <td>{m.class_name || m.className || '—'}</td>
//                   <td>{m.student_count ?? '—'}</td>
//                   <td><Link to={`${base}/mock-exams`} style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 700 }}>Xem</Link></td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ---------------- STUDENT ---------------- */

// function StudentDashboard({ stats, upcoming, base }: any) {
//   const attendanceRate = stats?.attendanceRate;
//   return (
//     <>
//       <div className="stats-grid">
//         <StatCard label="Lớp đang học" value={stats?.activeClasses ?? 0} icon={BookOpen} />
//         <StatCard label="Lịch học hôm nay" value={stats?.todaySessions ?? 0} icon={Calendar} tone="green" />
//         <StatCard label="Bài tập cần làm" value={stats?.pendingHomeworkCount ?? 0} icon={FileText} tone="orange" />
//         <StatCard label="Bài thi thử sắp tới" value={stats?.upcomingMockExamCount ?? 0} icon={BadgeCheck} tone="purple" />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <UpcomingHomeworkCard homework={stats?.upcomingHomework} base={base} />
//         <AttendanceRateCard rate={attendanceRate} present={stats?.attendancePresent} total={stats?.attendanceTotal} />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <RecentScoresChart data={stats?.recentScores} />
//         <MonthlyAttendanceChart data={stats?.monthlyAttendance} />
//       </div>

//       <div className="portal-grid-2" style={{ marginTop: 18 }}>
//         <div className="card">
//           <h3>Khu vực học viên</h3>
//           <div className="portal-link-grid">
//             <QuickLink to={`${base}/my-schedule`} title="Lịch học của tôi" desc="Xem buổi học sắp tới" icon={Calendar} />
//             <QuickLink to={`${base}/mock-exams`} title="Thi thử" desc="Làm bài được giao" icon={ClipboardList} />
//             <QuickLink to={`${base}/homework`} title="Bài tập về nhà" desc="Xem và nộp bài tập" icon={FileText} />
//             <QuickLink to={`${base}/my-attendance`} title="Điểm danh của tôi" desc="Theo dõi lịch sử điểm danh" icon={CheckCircle2} />
//           </div>
//         </div>
//         <UpcomingBox upcoming={upcoming} />
//       </div>
//     </>
//   );
// }

// function UpcomingHomeworkCard({ homework, base }: { homework: any[] | undefined; base: string }) {
//   return (
//     <div className="card">
//       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//         <h3>Bài tập sắp đến hạn</h3>
//         <Link to={`${base}/homework`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
//           Xem tất cả <ArrowRight size={12} />
//         </Link>
//       </div>
//       {!homework || homework.length === 0 ? (
//         <EmptyPanel title="Không có bài tập nào" desc="Bạn đã hoàn thành hết bài tập được giao." />
//       ) : (
//         <div style={{ display: 'grid', gap: 8 }}>
//           {homework.map((item) => {
//             const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
//             return (
//               <div key={item.id} className="mini-list-row">
//                 <div>
//                   <strong>{item.title}</strong>
//                   <div>{item.classNames || 'Chưa gán lớp'}</div>
//                 </div>
//                 <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--gray-500)', fontWeight: 700 }}>
//                   {item.dueDate ? new Date(item.dueDate).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Không hạn'}
//                 </span>
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }

// function AttendanceRateCard({ rate, present, total }: { rate: number | null; present?: number; total?: number }) {
//   return (
//     <div className="card">
//       <h3>Tỷ lệ điểm danh</h3>
//       {rate === null || rate === undefined ? (
//         <EmptyPanel title="Chưa có dữ liệu điểm danh" desc="Chưa có buổi học nào được điểm danh." />
//       ) : (
//         <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
//           <div style={{ position: 'relative', width: 120, height: 120, flex: 'none' }}>
//             <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
//               <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gray-100)" strokeWidth="12" />
//               <circle
//                 cx="60" cy="60" r="52" fill="none"
//                 stroke={rate >= 80 ? '#059669' : rate >= 60 ? '#f59e0b' : '#ef4444'}
//                 strokeWidth="12" strokeDasharray={`${(rate / 100) * 327} 327`} strokeLinecap="round"
//               />
//             </svg>
//             <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
//               <div style={{ textAlign: 'center' }}>
//                 <div style={{ fontWeight: 800, fontSize: 22 }}>{rate}%</div>
//               </div>
//             </div>
//           </div>
//           <div>
//             <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
//               Có mặt <strong>{present ?? 0}</strong> / <strong>{total ?? 0}</strong> buổi học
//             </div>
//             <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
//               <TrendingUp size={13} /> Tính trên toàn bộ lịch sử điểm danh
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// function MonthLabel(month: string) {
//   const [y, m] = month.split('-');
//   return `T${parseInt(m, 10)}/${y.slice(2)}`;
// }

// /* Admin/Staff */
// function NewStudentsChart({ data }: { data: any[] | undefined }) {
//   const chartData = (data || []).map((item) => ({ label: MonthLabel(item.month), count: item.count }));
//   return (
//     <div className="card">
//       <h3><TrendingUp size={16} color="var(--primary)" /> Học viên mới theo tháng</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có học viên nhập học trong 6 tháng qua." />
//       ) : (
//         <ResponsiveContainer width="100%" height={220}>
//           <BarChart data={chartData}>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />
//             <XAxis dataKey="label" fontSize={12} />
//             <YAxis fontSize={12} allowDecimals={false} />
//             <Tooltip />
//             <Bar dataKey="count" name="Học viên mới" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       )}
//     </div>
//   );
// }

// function ClassTypeChart({ data }: { data: any[] | undefined }) {
//   const LABELS: Record<string, string> = { fixed: 'Có thời hạn', open: 'Không thời hạn' };
//   const COLORS: Record<string, string> = { fixed: '#2563eb', open: '#f59e0b' };
//   const chartData = (data || []).map((item) => ({ name: LABELS[item.type] || item.type, value: item.count, color: COLORS[item.type] || '#94a3b8' }));
//   return (
//     <div className="card">
//       <h3><BookOpen size={16} color="var(--primary)" /> Loại lớp học</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có lớp học nào đang hoạt động." />
//       ) : (
//         <ResponsiveContainer width="100%" height={220}>
//           <PieChart>
//             <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
//               {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
//             </Pie>
//             <Tooltip />
//             <Legend />
//           </PieChart>
//         </ResponsiveContainer>
//       )}
//     </div>
//   );
// }

// /* Teacher */
// function TeacherAttendanceChart({ data }: { data: any[] | undefined }) {
//   const chartData = (data || []).map((item) => ({
//     label: new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'short' }),
//     'Tỷ lệ (%)': item.rate,
//   }));
//   return (
//     <div className="card">
//       <h3><TrendingUp size={16} color="var(--primary)" /> Điểm danh lớp tôi dạy (7 ngày)</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có buổi học nào của bạn được điểm danh gần đây." />
//       ) : (
//         <ResponsiveContainer width="100%" height={220}>
//           <BarChart data={chartData}>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />
//             <XAxis dataKey="label" fontSize={12} />
//             <YAxis fontSize={12} domain={[0, 100]} unit="%" />
//             <Tooltip formatter={(v: any) => `${v}%`} />
//             <Bar dataKey="Tỷ lệ (%)" fill="#059669" radius={[6, 6, 0, 0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       )}
//     </div>
//   );
// }

// function GradingProgressChart({ progress }: { progress: { graded: number; pending: number } | undefined }) {
//   const graded = progress?.graded || 0;
//   const pending = progress?.pending || 0;
//   const total = graded + pending;
//   const chartData = [
//     { name: 'Đã chấm', value: graded, color: '#059669' },
//     { name: 'Chờ chấm', value: pending, color: '#f97316' },
//   ];
//   return (
//     <div className="card">
//       <h3><BadgeCheck size={16} color="var(--primary)" /> Tiến độ chấm bài</h3>
//       {total === 0 ? (
//         <EmptyPanel title="Chưa có bài nộp nào" desc="Chưa có học viên nào nộp bài tập của bạn." />
//       ) : (
//         <div style={{ position: 'relative' }}>
//           <ResponsiveContainer width="100%" height={220}>
//             <PieChart>
//               <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
//                 {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
//               </Pie>
//               <Tooltip />
//               <Legend />
//             </PieChart>
//           </ResponsiveContainer>
//           <div style={{ position: 'absolute', top: '36%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
//             <div style={{ fontWeight: 800, fontSize: 20 }}>{Math.round((graded / total) * 100)}%</div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* Student */
// function RecentScoresChart({ data }: { data: any[] | undefined }) {
//   const chartData = (data || []).slice().reverse().map((item) => ({
//     label: item.title.length > 12 ? `${item.title.slice(0, 12)}…` : item.title,
//     percent: item.maxScore > 0 ? Math.round((item.score / item.maxScore) * 100) : 0,
//   }));
//   return (
//     <div className="card">
//       <h3><FileText size={16} color="var(--orange)" /> Điểm các bài tập gần đây</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có bài nào được chấm" desc="Khi giáo viên chấm bài, kết quả sẽ hiện ở đây." />
//       ) : (
//         <ResponsiveContainer width="100%" height={220}>
//           <BarChart data={chartData}>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />
//             <XAxis dataKey="label" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
//             <YAxis fontSize={12} domain={[0, 100]} unit="%" />
//             <Tooltip formatter={(v: any) => `${v}%`} />
//             <Bar dataKey="percent" name="Điểm (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       )}
//     </div>
//   );
// }

// function MonthlyAttendanceChart({ data }: { data: any[] | undefined }) {
//   const chartData = (data || []).map((item) => ({ label: MonthLabel(item.month), 'Tỷ lệ (%)': item.rate }));
//   return (
//     <div className="card">
//       <h3><TrendingUp size={16} color="var(--primary)" /> Điểm danh theo tháng</h3>
//       {chartData.length === 0 ? (
//         <EmptyPanel title="Chưa có dữ liệu" desc="Chưa có buổi học nào được điểm danh." />
//       ) : (
//         <ResponsiveContainer width="100%" height={220}>
//           <BarChart data={chartData}>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />
//             <XAxis dataKey="label" fontSize={12} />
//             <YAxis fontSize={12} domain={[0, 100]} unit="%" />
//             <Tooltip formatter={(v: any) => `${v}%`} />
//             <Bar dataKey="Tỷ lệ (%)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       )}
//     </div>
//   );
// }