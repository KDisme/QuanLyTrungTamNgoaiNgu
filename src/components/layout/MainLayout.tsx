import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const MainLayout = () => {
    return (
        <div className="layout">
            <Sidebar />
            <div className="content">
                <Header />
                <main className="app-main">
                    {/* Outlet sẽ hiển thị component của Route con tương ứng */}
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;