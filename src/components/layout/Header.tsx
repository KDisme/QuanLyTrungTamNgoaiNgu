import { Bell, ChevronDown } from "lucide-react";

const Header = () => {
    return (
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
    );
};

export default Header;