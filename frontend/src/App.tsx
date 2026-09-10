import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import MainLayout from './components/layout/MainLayout';
import { getPrimaryRole, getRoleHome } from './config/roleConfig';

// Pages
import LandingPage from './pages/LandingPage';
import PortalLogin from './pages/auth/PortalLogin';
import TenantLogin from './pages/auth/TenantLogin';
import RegisterPage from './pages/auth/RegisterPage';
import Dashboard from './pages/dashboard/Dashboard';
import RoleDashboard from './pages/portal/RoleDashboard';
import UsersPage from './pages/users/UsersPage';
import { TeachersPage, StaffPage, StudentsPage } from './pages/users/RolePages';
import AdaptiveTestPage from './pages/dev/AdaptiveTestPage';
import TeacherDetailPage from './pages/users/TeacherDetailPage';
import StaffDetailPage from './pages/users/StaffDetailPage';
import StudentDetailPage from './pages/users/StudentDetailPage';
import ClassesPage from './pages/classes/ClassesPage';
import ClassDetailPage from './pages/classes/ClassDetailPage';
import SchedulesPage from './pages/schedules/SchedulesPage';
import AttendancePage from './pages/attendance/AttendancePage';
import AttendanceTakePage from './pages/attendance/AttendanceTakePage';
import TuitionPage from './pages/tuition/TuitionPage';
import FeeTemplatesPage from './pages/tuition/FeeTemplatesPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import SettingsPage from './pages/SettingsPage';
import QuestionBankPage from './pages/exams/QuestionBankPage';
import ExamSetsPage from './pages/exams/ExamSetsPage';
import MockExamsPage from './pages/exams/MockExamsPage';
import StudentMockExamTakePage from './pages/exams/StudentMockExamTakePage';
import HomeworkAssignmentsPage from './pages/homework/HomeworkAssignmentsPage';
import HomeworkTakePage from './pages/homework/HomeworkTakePage';
import ProfilePage from './pages/profile/ProfilePage';
import StudentAttendancePage from './pages/student/StudentAttendancePage';
import StudentFeesPage from './pages/student/StudentFeesPage';
import PlaceholderPage from './pages/student/PlaceholderPage';
import NotificationsPage from './pages/student/NotificationsPage';
import { DEFAULT_TENANT_SLUG } from './api';
import HomeworkPreviewPage from './pages/student/HomeworkPreviewPage';
import HomeworkFormPage from './pages/homework/HomeworkFormPage';
import ActivityLogPage from './pages/admin/ActivityLogPage';
import BranchesPage from './pages/branches/BranchesPage';
import BranchDetailPage from './pages/branches/BranchDetailPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthReady } = useAuth();
  const { tenantSlug } = useParams();

  if (!isAuthReady) return null;
  if (!isAuthenticated) {
    return <Navigate to={`/${tenantSlug}/login`} replace />;
  }
  return <>{children}</>;
}

function RoleRedirect() {
  const { user, tenantSlug } = useAuth();
  return <Navigate to={getRoleHome(tenantSlug, user?.roles)} replace />;
}

function RoleRoute({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const { user, tenantSlug } = useAuth();
  const allowed = user?.roles?.some(role => allow.includes(role)) ?? false;
  if (!allowed) return <Navigate to={getRoleHome(tenantSlug, user?.roles)} replace />;
  return <>{children}</>;
}

function WrongPortalGuard({ role, children }: { role: string; children: React.ReactNode }) {
  const { user, tenantSlug } = useAuth();
  const primaryRole = getPrimaryRole(user?.roles);
  if (primaryRole !== role) return <Navigate to={getRoleHome(tenantSlug, user?.roles)} replace />;
  return <>{children}</>;
}

function TenantApp() {
  const { tenantSlug } = useParams();
  const { tenantSlug: authSlug, isAuthenticated } = useAuth();

  if (isAuthenticated && authSlug && tenantSlug !== authSlug) {
    return <Navigate to={`/${authSlug}/dashboard`} replace />;
  }

  return (
    <Routes>
      <Route path="dev/adaptive-test" element={<AdaptiveTestPage />} />
      <Route path="login" element={<TenantLogin />} />
      <Route path="student/mock-exams/:id/take" element={
        <ProtectedRoute>
          <RoleRoute allow={['student']}>
            <StudentMockExamTakePage mode="mock" />
          </RoleRoute>
        </ProtectedRoute>
      } />
      <Route path="student/mock-exams/:id/practice" element={
        <ProtectedRoute>
          <RoleRoute allow={['student']}>
            <StudentMockExamTakePage mode="practice" />
          </RoleRoute>
        </ProtectedRoute>
      } />
      <Route path="student/homework/:id/take" element={
        <ProtectedRoute>
          <RoleRoute allow={['student']}>
            <HomeworkTakePage />
          </RoleRoute>
        </ProtectedRoute>
      } />
      <Route path="admin/homework/create" element={
        <ProtectedRoute>
          <RoleRoute allow={['admin']}>
            <HomeworkFormPage />
          </RoleRoute>
        </ProtectedRoute>
      } />
      <Route path="admin/homework/:id/edit" element={
        <ProtectedRoute>
          <RoleRoute allow={['admin']}>
            <HomeworkFormPage />
          </RoleRoute>
        </ProtectedRoute>
      } />
      {/* Staff không được tạo/sửa bài tập — backend chỉ cho admin/teacher */}
      <Route path="teacher/homework/create" element={
        <ProtectedRoute>
          <RoleRoute allow={['teacher']}>
            <HomeworkFormPage />
          </RoleRoute>
        </ProtectedRoute>
      } />
      <Route path="teacher/homework/:id/edit" element={
        <ProtectedRoute>
          <RoleRoute allow={['teacher']}>
            <HomeworkFormPage />
          </RoleRoute>
        </ProtectedRoute>
      } />
      <Route path="" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<RoleRedirect />} />
        <Route path="dashboard" element={<RoleRedirect />} />

        {/* Admin Portal */}
        <Route path="admin" element={<WrongPortalGuard role="admin"><RoleRedirect /></WrongPortalGuard>} />
        <Route path="admin/dashboard" element={<RoleRoute allow={['admin']}><RoleDashboard /></RoleRoute>} />
        <Route path="admin/full-dashboard" element={<Navigate to="../dashboard" replace />} />
        <Route path="admin/teachers" element={<RoleRoute allow={['admin']}><TeachersPage /></RoleRoute>} />
        <Route path="admin/teachers/:id" element={<RoleRoute allow={['admin']}><TeacherDetailPage /></RoleRoute>} />
        <Route path="admin/staff" element={<RoleRoute allow={['admin']}><StaffPage /></RoleRoute>} />
        <Route path="admin/staff/:id" element={<RoleRoute allow={['admin']}><StaffDetailPage /></RoleRoute>} />
        <Route path="admin/students" element={<RoleRoute allow={['admin']}><StudentsPage /></RoleRoute>} />
        <Route path="admin/students/:id" element={<RoleRoute allow={['admin']}><StudentDetailPage /></RoleRoute>} />
        <Route path="admin/users" element={<RoleRoute allow={['admin']}><UsersPage /></RoleRoute>} />
        <Route path="admin/branches" element={<RoleRoute allow={['admin']}><BranchesPage /></RoleRoute>} />
        <Route path="admin/branches/:id" element={<RoleRoute allow={['admin']}><BranchDetailPage /></RoleRoute>} />
        <Route path="admin/classes" element={<RoleRoute allow={['admin']}><ClassesPage /></RoleRoute>} />
        <Route path="admin/classes/:id" element={<RoleRoute allow={['admin']}><ClassDetailPage /></RoleRoute>} />
        <Route path="admin/schedules" element={<RoleRoute allow={['admin']}><SchedulesPage /></RoleRoute>} />
        <Route path="admin/attendance" element={<RoleRoute allow={['admin']}><AttendancePage /></RoleRoute>} />
        <Route path="admin/attendance/take/:scheduleId" element={<RoleRoute allow={['admin']}><AttendanceTakePage /></RoleRoute>} />
        <Route path="admin/exam-questions" element={<RoleRoute allow={['admin']}><QuestionBankPage /></RoleRoute>} />
        <Route path="admin/exam-sets" element={<RoleRoute allow={['admin']}><ExamSetsPage /></RoleRoute>} />
        <Route path="admin/mock-exams" element={<RoleRoute allow={['admin']}><MockExamsPage /></RoleRoute>} />
        <Route path="admin/homework" element={<RoleRoute allow={['admin']}><HomeworkAssignmentsPage /></RoleRoute>} />
        <Route path="admin/activity-logs" element={<RoleRoute allow={['admin']}><ActivityLogPage /></RoleRoute>} />
        <Route path="admin/tuition" element={<RoleRoute allow={['admin', 'staff']}><TuitionPage /></RoleRoute>} />
        <Route path="admin/expenses" element={<RoleRoute allow={['admin', 'staff']}><ExpensesPage /></RoleRoute>} />
        <Route path="admin/fee-templates" element={<RoleRoute allow={['admin', 'staff']}><FeeTemplatesPage /></RoleRoute>} />
        <Route path="admin/settings" element={<RoleRoute allow={['admin']}><SettingsPage /></RoleRoute>} />

        {/* Staff Portal */}
        <Route path="staff" element={<WrongPortalGuard role="staff"><RoleRedirect /></WrongPortalGuard>} />
        <Route path="staff/dashboard" element={<RoleRoute allow={['staff']}><RoleDashboard /></RoleRoute>} />
        <Route path="staff/students" element={<RoleRoute allow={['staff']}><StudentsPage /></RoleRoute>} />
        <Route path="staff/students/:id" element={<RoleRoute allow={['staff']}><StudentDetailPage /></RoleRoute>} />
        <Route path="staff/classes" element={<RoleRoute allow={['staff']}><ClassesPage /></RoleRoute>} />
        <Route path="staff/classes/:id" element={<RoleRoute allow={['staff']}><ClassDetailPage /></RoleRoute>} />
        <Route path="staff/schedules" element={<RoleRoute allow={['staff']}><SchedulesPage /></RoleRoute>} />
        <Route path="staff/attendance" element={<RoleRoute allow={['staff']}><AttendancePage /></RoleRoute>} />
        <Route path="staff/attendance/take/:scheduleId" element={<RoleRoute allow={['staff']}><AttendanceTakePage /></RoleRoute>} />
        <Route path="staff/tuition" element={<RoleRoute allow={['staff']}><TuitionPage /></RoleRoute>} />
        <Route path="staff/fee-templates" element={<RoleRoute allow={['staff']}><FeeTemplatesPage /></RoleRoute>} />
        <Route path="staff/exam-questions" element={<RoleRoute allow={['staff']}><QuestionBankPage /></RoleRoute>} />
        <Route path="staff/exam-sets" element={<RoleRoute allow={['staff']}><ExamSetsPage /></RoleRoute>} />
        <Route path="staff/mock-exams" element={<RoleRoute allow={['staff']}><MockExamsPage /></RoleRoute>} />
        <Route path="staff/homework" element={<RoleRoute allow={['staff']}><HomeworkAssignmentsPage /></RoleRoute>} />

        {/* Teacher Portal */}
        <Route path="teacher" element={<WrongPortalGuard role="teacher"><RoleRedirect /></WrongPortalGuard>} />
        <Route path="teacher/dashboard" element={<RoleRoute allow={['teacher']}><RoleDashboard /></RoleRoute>} />
        <Route path="teacher/my-classes" element={<RoleRoute allow={['teacher']}><ClassesPage /></RoleRoute>} />
        <Route path="teacher/my-classes/:id" element={<RoleRoute allow={['teacher']}><ClassDetailPage /></RoleRoute>} />
        <Route path="teacher/my-schedule" element={<RoleRoute allow={['teacher']}><SchedulesPage /></RoleRoute>} />
        <Route path="teacher/attendance" element={<RoleRoute allow={['teacher']}><AttendancePage /></RoleRoute>} />
        <Route path="teacher/attendance/take/:scheduleId" element={<RoleRoute allow={['teacher']}><AttendanceTakePage /></RoleRoute>} />
        <Route path="teacher/my-students" element={<Navigate to="../dashboard" replace />} />
        <Route path="teacher/my-students/:id" element={<Navigate to="../../dashboard" replace />} />
        <Route path="teacher/exam-questions" element={<RoleRoute allow={['teacher']}><QuestionBankPage /></RoleRoute>} />
        <Route path="teacher/grading" element={<RoleRoute allow={['teacher']}><MockExamsPage /></RoleRoute>} />
        <Route path="teacher/homework" element={<RoleRoute allow={['teacher']}><HomeworkAssignmentsPage /></RoleRoute>} />
        <Route path="teacher/results" element={<Navigate to="../dashboard" replace />} />
        <Route path="teacher/profile" element={<RoleRoute allow={['teacher']}><ProfilePage /></RoleRoute>} />

        {/* Student Portal */}
        <Route path="student" element={<WrongPortalGuard role="student"><RoleRedirect /></WrongPortalGuard>} />
        <Route path="student/dashboard" element={<RoleRoute allow={['student']}><RoleDashboard /></RoleRoute>} />
        <Route path="student/my-classes" element={<RoleRoute allow={['student']}><ClassesPage /></RoleRoute>} />
        <Route path="student/my-classes/:id" element={<RoleRoute allow={['student']}><ClassDetailPage /></RoleRoute>} />
        <Route path="student/my-schedule" element={<RoleRoute allow={['student']}><SchedulesPage /></RoleRoute>} />
        <Route path="student/my-attendance" element={<RoleRoute allow={['student']}><StudentAttendancePage /></RoleRoute>} />
        <Route path="student/my-fees" element={<RoleRoute allow={['student']}><StudentFeesPage /></RoleRoute>} />
        <Route path="student/mock-exams" element={<RoleRoute allow={['student']}><MockExamsPage /></RoleRoute>} />
        <Route path="student/homework" element={<RoleRoute allow={['student']}><HomeworkAssignmentsPage /></RoleRoute>} />
        <Route path="student/homework/:id/preview" element={<RoleRoute allow={['student']}><HomeworkPreviewPage /></RoleRoute>} />
        
        <Route path="student/my-results" element={<Navigate to="../dashboard" replace />} />
        <Route path="student/materials" element={<Navigate to="../dashboard" replace />} />
        <Route path="student/notifications" element={<RoleRoute allow={['student']}><NotificationsPage /></RoleRoute>} />
        <Route path="student/profile" element={<RoleRoute allow={['student']}><ProfilePage /></RoleRoute>} />

        {/* Legacy URLs: redirect về portal đúng role để tránh vào nhầm layout cũ */}
        <Route path="teachers/*" element={<RoleRedirect />} />
        <Route path="staff/*" element={<RoleRedirect />} />
        <Route path="students/*" element={<RoleRedirect />} />
        <Route path="users/*" element={<RoleRedirect />} />
        <Route path="branches/*" element={<RoleRedirect />} />
        <Route path="classes/*" element={<RoleRedirect />} />
        <Route path="schedules/*" element={<RoleRedirect />} />
        <Route path="attendance/*" element={<RoleRedirect />} />
        <Route path="exam-questions/*" element={<RoleRedirect />} />
        <Route path="exam-sets/*" element={<RoleRedirect />} />
        <Route path="mock-exams/*" element={<RoleRedirect />} />
        <Route path="homework/*" element={<RoleRedirect />} />
        <Route path="tuition/*" element={<RoleRedirect />} />
        <Route path="expenses/*" element={<RoleRedirect />} />
        <Route path="fee-templates/*" element={<RoleRedirect />} />
        <Route path="settings/*" element={<RoleRedirect />} />

        <Route path="*" element={<RoleRedirect />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const { isAuthenticated, isAuthReady, tenantSlug, user } = useAuth();

  if (!isAuthReady) return null;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal/select" element={<Navigate to={`/${DEFAULT_TENANT_SLUG}/login`} replace />} />
      <Route path="/:tenantSlug/*" element={<TenantApp />} />
      <Route path="*" element={
        isAuthenticated && tenantSlug
          ? <Navigate to={getRoleHome(tenantSlug, user?.roles)} replace />
          : <Navigate to="/" replace />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font)',
              fontSize: 13,
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
