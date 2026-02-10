import {
  GraduationCap,
  Users,
  BarChart3,
  BookOpen,
  Bell,
  User,
  ChevronDown,
  Lock,
  CalendarDays
} from "lucide-react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path: string) => navigate(path);

  const isActive = (path: string) => (location.pathname === path ? "nav-item active" : "nav-item");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <GraduationCap size={28} color="#fff" style={{ marginRight: 10 }} />
          <span className="sidebar-brand-title">Edu Center</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-title">Tổng quan</p>
            <button className={isActive("/dashboard")} onClick={() => go("/dashboard")}>
              <BarChart3 size={18} />
              <span>Bảng điều khiển</span>
            </button>
          </div>

          <div className="nav-group">
            <p className="nav-title">Quản lý </p>

            <button className={isActive("/teacher-management")} onClick={() => go("/teacher-management")}>
              <Users size={18} />
              <span>Giảng viên</span>
            </button>

            <button className={isActive("/student-management")} onClick={() => go("/student-management")}>
              <User size={18} />
              <span>Học viên</span>
            </button>

            <button className={isActive("/change-password")} onClick={() => go("/change-password")}>
              <Lock size={18} />
              <span>Đổi mật khẩu</span>
            </button>
          </div>

          <div className="nav-group">
            <p className="nav-title">Quản lý Giảng dạy</p>

            <button className={isActive("/class-management")} onClick={() => go("/class-management")}>
              <BookOpen size={18} />
              <span>Lớp học</span>
            </button>

            <button className={isActive("/schedule-management")} onClick={() => go("/schedule-management")}>
              <CalendarDays size={18} />
              <span>Lịch học tổng hợp</span>
            </button>
          </div>
        </nav>
      </aside>

      <div className="content">
        <header className="app-header">
          <h1 className="app-header-title">Hệ thống Quản lý Trung tâm Đào tạo</h1>

          <div className="header-right">
            <div className="bell-wrap" title="Thông báo">
              <Bell size={18} color="#94a3b8" />
              <span className="bell-dot"></span>
            </div>

            <div className="profile">
              <div className="profile-meta">
                <p className="profile-name">Admin</p>
                <p className="profile-role">Quản trị viên</p>
              </div>

              <div className="profile-avatar">A</div>
              <ChevronDown size={16} color="#94a3b8" />
            </div>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
