import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
    const token = localStorage.getItem("token"); // Dùng 'token'

    // Nếu không có token thì điều hướng về trang login (path="/")
    // Nếu path login của bạn là /login thì nên sửa về <Navigate to="/login" replace />
    return token ? <Outlet /> : <Navigate to="/" replace />;
};

export default ProtectedRoute;git add.