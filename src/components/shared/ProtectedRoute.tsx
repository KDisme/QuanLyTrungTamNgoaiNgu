import { Outlet } from "react-router-dom";

const ProtectedRoute = () => {
    // Tạm thời bỏ qua kiểm tra token để có thể gõ URL chuyển trang tự do
    return <Outlet />; 
};

export default ProtectedRoute;