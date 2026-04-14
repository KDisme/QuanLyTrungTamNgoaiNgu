import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./styles/global.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import ChangePassword from "./pages/ChangePasswordForm";
import ClassManagement from "./pages/ClassManagement";
import StudentManagement from "./pages/StudenManagement";
import TeacherManagement from "./pages/TeacherManagement";
import ScheduleManagement from "./pages/ScheduleManagement";
import StudentCompletionHistory from "./pages/StudentCompletionHistory";
import ExamSetManagement from "./pages/ExamSetManagement";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* Register is temporarily disabled */}
        <Route path="/register" element={<Navigate to="/" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route element={<Dashboard />}>
            <Route path="/class-management" element={<ClassManagement />} />
            <Route path="/student-management" element={<StudentManagement />} />
            <Route path="/teacher-management" element={<TeacherManagement />} />
            <Route path="/schedule-management" element={<ScheduleManagement />} />
            <Route path="/exam-set-management" element={<ExamSetManagement />} />
            <Route path="/student-completion-history" element={<StudentCompletionHistory />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
