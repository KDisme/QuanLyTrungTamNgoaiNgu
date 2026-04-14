import React from "react";
import { Users, BarChart3, BookOpen, User, CalendarDays, Menu, History, FileText, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import brandLogo from "../assets/logo.svg";

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path: string) => navigate(path);
  const isActive = (path: string) => (location.pathname === path ? "nav-item active" : "nav-item");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  return (
    <aside className={`sidebar ${isSidebarOpen ? "" : "collapsed"}`}>
      <div className="sidebar-brand">
        <Menu 
          size={24} 
          color="#0f172a" 
          style={{ cursor: "pointer", marginRight: isSidebarOpen ? 10 : 0 }} 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <img
          src={brandLogo}
          alt="Edu Center Logo"
          className={`sidebar-logo ${isSidebarOpen ? "" : "collapsed"}`}
        />
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
          <p className="nav-title">Quản lý người dùng</p>

          <button className={isActive("/teacher-management")} onClick={() => go("/teacher-management")}>
            <Users size={18} />
            <span>Giảng viên</span>
          </button>

          <button className={isActive("/student-management")} onClick={() => go("/student-management")}>
            <User size={18} />
            <span>Học viên</span>
          </button>

          <button className={isActive("/student-completion-history")} onClick={() => go("/student-completion-history")}>
            <History size={18} />
            <span>Lịch sử hoàn thành</span>
          </button>
        </div>

        <div className="nav-group">
          <p className="nav-title">Quản lý giảng dạy</p>

          <button className={isActive("/class-management")} onClick={() => go("/class-management")}>
            <BookOpen size={18} />
            <span>Lớp học</span>
          </button>

          <button className={isActive("/schedule-management")} onClick={() => go("/schedule-management")}>
            <CalendarDays size={18} />
            <span>Lịch học tổng hợp</span>
          </button>
        </div>

        <div className="nav-group">
          <p className="nav-title">Quản lý đề thi</p>

          <button className={isActive("/exam-set-management")} onClick={() => go("/exam-set-management")}>
            <FileText size={18} />
            <span>Bộ đề thi</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" type="button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
};
