import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./styles/global.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import ChangePassword from "./pages/ChangePasswordForm";
import ClassManagement from "./pages/ClassManagement";
import StudentManagement from "./pages/StudenManagement";
import TeacherManagement from "./pages/TeacherManagement";
import ScheduleManagement from "./pages/ScheduleManagement";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Dashboard />}>
            <Route
              index
              path="/dashboard"
              element={<div className="p-6">Chào mừng quay lại!</div>}
            />
            <Route path="/class-management" element={<ClassManagement />} />
            <Route path="/student-management" element={<StudentManagement />} />
            <Route path="/teacher-management" element={<TeacherManagement />} />
            <Route path="/schedule-management" element={<ScheduleManagement />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
