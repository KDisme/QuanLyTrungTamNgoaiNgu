// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Import Styles từ thư mục styles mới
import "./styles/global.css";

// Import Layout và Protected Route
import MainLayout from "./components/layout/MainLayout";
// import ProtectedRoute from "./components/shared/ProtectedRoute";

// Import Pages từ các thư mục tính năng (Auth, Classes, Students, v.v.)
// import Login from "./pages/auth/Login";
// import Register from "./pages/auth/Register";
// import ChangePassword from "./pages/auth/ChangePasswordForm";
// import ClassManagement from "./pages/classes/ClassManagement";
// import ClassDetail from "./pages/classes/ClassDetail";
// import StudentManagement from "./pages/students/StudenManagement";
// import TeacherManagement from "./pages/teachers/TeacherManagement";
// import ScheduleManagement from "./pages/schedule/ScheduleManagement";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes: Đăng nhập và Đăng ký */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Private Routes: Yêu cầu Token qua ProtectedRoute */}
        <Route element={<ProtectedRoute />}>
          {/* Sử dụng MainLayout làm khung chung cho tất cả trang quản trị */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<div className="p-6">Chào mừng quay lại!</div>} />

            {/* Module Quản lý lớp học */}
            <Route path="/class-management" element={<ClassManagement />} />
            <Route path="/class-management/:id" element={<ClassDetail />} />

            {/* Các module quản lý khác */}
            <Route path="/student-management" element={<StudentManagement />} />
            <Route path="/teacher-management" element={<TeacherManagement />} />
            <Route path="/schedule-management" element={<ScheduleManagement />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
        </Route>

        {/* Redirect tất cả các đường dẫn lạ về trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}