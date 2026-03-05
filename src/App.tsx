import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Import Styles
import "./styles/global.css";

// Import Layout và Protected Route
import MainLayout from "./components/layout/MainLayout"; // Sử dụng MainLayout đã tách
import ProtectedRoute from "./components/shared/ProtectedRoute";

// Import các trang từ thư mục pages mới (theo cấu trúc Feature-based)
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ChangePassword from "./pages/auth/ChangePasswordForm";

import ClassManagement from "./pages/classes/ClassManagement";
import ClassDetail from "./pages/classes/ClassDetail";

import StudentManagement from "./pages/students/StudenManagement";
import TeacherManagement from "./pages/teachers/TeacherManagement";
import ScheduleManagement from "./pages/schedule/ScheduleManagement";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Private Routes - Yêu cầu đăng nhập */}
        <Route element={<ProtectedRoute />}>
          {/* MainLayout bao bọc Sidebar và Header cho các trang quản trị */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<div className="p-6">Chào mừng quay lại!</div>} />

            {/* Quản lý lớp học */}
            <Route path="/class-management" element={<ClassManagement />} />
            <Route path="/class-management/:id" element={<ClassDetail />} />

            {/* Quản lý thực thể khác */}
            <Route path="/student-management" element={<StudentManagement />} />
            <Route path="/teacher-management" element={<TeacherManagement />} />
            <Route path="/schedule-management" element={<ScheduleManagement />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
        </Route>

        {/* Mặc định điều hướng về trang chủ nếu sai đường dẫn */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}