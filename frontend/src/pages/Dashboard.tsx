import React, { useEffect, useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { Users, BookOpen, GraduationCap, Calendar as CalendarIcon, ArrowUpRight, Signal } from "lucide-react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

import { apiGetAllStudents } from "../api/studentService";
import { apiGetAllTeachers } from "../api/teacherService";
import { apiGetAllClasses } from "../api/classService";
import { apiGetAllSchedules } from "../api/scheduleService";

dayjs.extend(isSameOrAfter);

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const isOverview = location.pathname === "/dashboard";

  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0 });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [schRes, clsRes, teaRes, stuRes] = await Promise.all([
        apiGetAllSchedules(),
        apiGetAllClasses(),
        apiGetAllTeachers(),
        apiGetAllStudents(),
      ]);

      const schedulesData = Array.isArray(schRes.data) ? schRes.data : schRes.data?.schedules || schRes.data?.data || [];
      const classesData = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || clsRes.data?.data || [];
      const teachersData = Array.isArray(teaRes.data) ? teaRes.data : teaRes.data?.teachers || teaRes.data?.data || [];
      const studentsData = Array.isArray(stuRes.data) ? stuRes.data : stuRes.data?.students || stuRes.data?.data || [];

      setStats({
        classes: classesData.length,
        teachers: teachersData.length,
        students: studentsData.length,
      });

      const classMap = new Map();
      classesData.forEach((c: any) => classMap.set(c.id, c.name));
      const teaMap = new Map();
      teachersData.forEach((t: any) => teaMap.set(t.id, t.full_name));

      setSchedules(schedulesData.map((s: any) => ({
        ...s,
        class_name: classMap.get(s.class_id) || `ID: ${s.class_id}`,
        teacher_name: teaMap.get(s.teacher_id) || `ID: ${s.teacher_id}`,
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOverview) fetchOverviewData();
  }, [isOverview]);

  const upcomingSchedules = useMemo(() => {
    const today = dayjs().startOf("day");
    return schedules
      .filter((s) => dayjs(s.teaching_date).isSameOrAfter(today))
      .sort((a, b) => dayjs(a.teaching_date).valueOf() - dayjs(b.teaching_date).valueOf())
      .slice(0, 20);
  }, [schedules]);

  const StatCard = ({ title, value, icon, color, trend }: any) => (
    <div className="card" style={{ padding: "28px", flex: 1, minWidth: "260px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "100px", height: "100px", background: color, opacity: 0.05, borderRadius: "50%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ background: color, color: "white", width: "48px", height: "48px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 16px -4px ${color}44` }}>
          {icon}
        </div>
        {trend && (
          <div style={{ color: "#10b981", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, background: "#ecfdf5", padding: "4px 8px", borderRadius: "8px", height: "fit-content" }}>
            <ArrowUpRight size={14} /> {trend}
          </div>
        )}
      </div>
      <div>
        <p style={{ color: "var(--muted)", fontSize: "14px", fontWeight: 500, margin: "0 0 4px 0" }}>{title}</p>
        <h3 style={{ fontSize: "32px", fontWeight: 800, margin: 0, color: "var(--text)", letterSpacing: "-1px" }}>{loading ? "..." : value}</h3>
      </div>
    </div>
  );

  return (
    <div className="layout">
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className="content">
        <Header />
        <main className="app-main">
          {isOverview ? (
            <div className="container" style={{ animation: "fadeIn 0.5s ease-out" }}>
              <div style={{ display: "flex", gap: "24px", marginBottom: "32px", flexWrap: "wrap", marginTop: "8px" }}>
                <StatCard title="Tổng Học viên" value={stats.students} icon={<GraduationCap size={24} />} color="#f97316" />
                <StatCard title="Giảng viên" value={stats.teachers} icon={<Users size={24} />} color="#fb923c" />
                <StatCard title="Lớp học đang có" value={stats.classes} icon={<BookOpen size={24} />} color="#fcd34d" />
              </div>

              <div className="card" style={{ padding: 0, border: "none" }}>
                <div style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--info-bg)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CalendarIcon size={20} />
                    </div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Lịch học tổng hợp sắp tới</h2>
                  </div>
                  <button className="btn-outline" style={{ borderRadius: "12px", padding: "8px 16px" }}>Xem tất cả</button>
                </div>

                <div className="table-wrap" style={{ padding: "0 16px 16px 16px" }}>
                  <table className="table" style={{ borderCollapse: "separate", borderSpacing: "0 8px" }}>
                    <thead>
                      <tr style={{ background: "transparent" }}>
                        <th style={{ background: "transparent", padding: "12px 20px" }}>Ngày dạy</th>
                        <th style={{ background: "transparent" }} className="th-center">Giờ học</th>
                        <th style={{ background: "transparent" }}>Lớp học</th>
                        <th style={{ background: "transparent" }}>Giảng viên</th>
                        <th style={{ background: "transparent" }}>Phòng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingSchedules.length === 0 ? (
                        <tr><td colSpan={5} className="row-empty">{loading ? "Đang tải dữ liệu..." : "Chưa có lịch dạy mới"}</td></tr>
                      ) : (
                        upcomingSchedules.map((r, i) => (
                          <tr key={i} style={{ background: "white", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                            <td className="td-strong" style={{ borderRadius: "12px 0 0 12px", padding: "16px 20px" }}>{dayjs(r.teaching_date).format("DD/MM/YYYY")}</td>
                            <td className="td-center" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(r.start_time).slice(0, 5)} - {String(r.end_time).slice(0, 5)}</td>
                            <td><span style={{ background: "#f1f5f9", padding: "4px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}>{r.class_name}</span></td>
                            <td style={{ fontWeight: 500 }}>{r.teacher_name}</td>
                            <td style={{ borderRadius: "0 12px 12px 0", color: "var(--muted)" }}>{r.room || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .table tbody tr { transition: all 0.2s ease; }
        .table tbody tr:hover { transform: scale(1.005); box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important; z-index: 10; cursor: default; }
      `}</style>
    </div>
  );
}
