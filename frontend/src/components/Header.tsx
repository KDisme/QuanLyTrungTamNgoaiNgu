import React, { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const goToChangePassword = () => {
    setIsMenuOpen(false);
    navigate("/change-password");
  };

  return (
    <header className="app-header">
      <h1 className="app-header-title">Hệ thống Quản lý Trung tâm Đào tạo</h1>

      <div className="header-right">
        <div className="bell-wrap" title="Thông báo">
          <Bell size={18} color="#94a3b8" />
          <span className="bell-dot"></span>
        </div>

        <div className="profile-menu" ref={menuRef}>
          <button
            type="button"
            className="profile"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <div className="profile-meta">
              <p className="profile-name">Admin</p>
              <p className="profile-role">Quản trị viên</p>
            </div>

            <div className="profile-avatar">A</div>
            <ChevronDown size={16} color="#94a3b8" />
          </button>

          {isMenuOpen && (
            <div className="profile-dropdown" role="menu">
              <button type="button" className="profile-dropdown-item" onClick={goToChangePassword}>
                <Lock size={16} />
                <span>Đổi mật khẩu</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
