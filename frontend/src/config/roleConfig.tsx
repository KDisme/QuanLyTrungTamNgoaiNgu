import React from 'react';
import {
  LayoutDashboard, Users, GraduationCap, UserCheck,
  BookOpen, Calendar, ClipboardList, FileText,
  Settings, Briefcase, HelpCircle, ClipboardCheck, UserCircle,
  Bell, History
} from 'lucide-react';

export type RoleType = 'admin' | 'staff' | 'teacher' | 'student';

export type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
};

export type NavGroup = {
  section: string;
  items: NavItem[];
};

export const ROLE_PRIORITY: RoleType[] = ['admin', 'staff', 'teacher', 'student'];

export const ROLE_LABELS: Record<RoleType, string> = {
  admin: 'Admin',
  staff: 'Nhân viên',
  teacher: 'Giáo viên',
  student: 'Học viên',
};

export const ROLE_PORTAL_NAMES: Record<RoleType, string> = {
  admin: 'Admin Portal',
  staff: 'Staff Portal',
  teacher: 'Teacher Portal',
  student: 'Student Portal',
};

export function getPrimaryRole(roles?: string[] | null): RoleType {
  const matched = ROLE_PRIORITY.find(role => roles?.includes(role));
  return matched || 'student';
}

export function getRoleHome(tenantSlug?: string | null, roles?: string[] | null) {
  const slug = tenantSlug || localStorage.getItem('tenantSlug') || '';
  const role = getPrimaryRole(roles);
  return `/${slug}/${role}/dashboard`;
}

export const ROLE_NAV: Record<RoleType, NavGroup[]> = {
  admin: [
    { section: 'TỔNG QUAN', items: [{ to: 'admin/dashboard', label: 'Dashboard tổng', icon: LayoutDashboard }] },
    {
      section: 'NHÂN SỰ',
      items: [
        { to: 'admin/teachers', label: 'Giáo viên', icon: GraduationCap },
        { to: 'admin/staff', label: 'Nhân viên', icon: Briefcase },
        { to: 'admin/students', label: 'Học viên', icon: UserCheck },
        { to: 'admin/users', label: 'Tài khoản', icon: Users },
      ],
    },
    {
      section: 'ĐÀO TẠO',
      items: [
        { to: 'admin/classes', label: 'Lớp học', icon: BookOpen },
        { to: 'admin/schedules', label: 'Lịch học', icon: Calendar },
        { to: 'admin/attendance', label: 'Điểm danh', icon: ClipboardList },
      ],
    },
    {
      section: 'THI THỬ',
      items: [
        { to: 'admin/exam-questions', label: 'Ngân hàng câu hỏi', icon: HelpCircle },
        { to: 'admin/exam-sets', label: 'Bộ đề thi', icon: FileText },
        { to: 'admin/mock-exams', label: 'Kỳ thi thử', icon: ClipboardCheck },
        { to: 'admin/homework', label: 'Bài tập về nhà', icon: FileText },
      ],
    },
    {
      section: 'HỆ THỐNG',
      items: [
        { to: 'admin/activity-logs', label: 'Lịch sử hoạt động', icon: History },
      ],
    },
  ],
  staff: [
    { section: 'TỔNG QUAN', items: [{ to: 'staff/dashboard', label: 'Việc hôm nay', icon: LayoutDashboard }] },
    {
      section: 'VẬN HÀNH',
      items: [
        { to: 'staff/students', label: 'Học viên', icon: UserCheck },
        { to: 'staff/classes', label: 'Ghi danh / lớp học', icon: BookOpen },
        { to: 'staff/schedules', label: 'Lịch học', icon: Calendar },
        { to: 'staff/attendance', label: 'Theo dõi điểm danh', icon: ClipboardList },
      ],
    },
    {
      section: 'THI THỬ',
      items: [
        { to: 'staff/exam-questions', label: 'Ngân hàng câu hỏi', icon: HelpCircle },
        { to: 'staff/exam-sets', label: 'Bộ đề thi', icon: FileText },
        { to: 'staff/mock-exams', label: 'Kỳ thi thử', icon: ClipboardCheck },
      ],
    },
  ],
  teacher: [
    { section: 'TỔNG QUAN', items: [{ to: 'teacher/dashboard', label: 'Dashboard giáo viên', icon: LayoutDashboard }] },
    {
      section: 'GIẢNG DẠY',
      items: [
        { to: 'teacher/my-classes', label: 'Lớp của tôi', icon: BookOpen },
        { to: 'teacher/my-schedule', label: 'Lịch dạy', icon: Calendar },
        { to: 'teacher/attendance', label: 'Điểm danh', icon: ClipboardList },
      ],
    },
    {
      section: 'ĐÁNH GIÁ',
      items: [
        { to: 'teacher/exam-questions', label: 'Ngân hàng câu hỏi', icon: HelpCircle },
        { to: 'teacher/grading', label: 'Thi thử / chấm bài', icon: ClipboardCheck },
        { to: 'teacher/homework', label: 'Bài tập về nhà', icon: FileText },
      ],
    },
    { section: 'CÁ NHÂN', items: [{ to: 'teacher/profile', label: 'Hồ sơ cá nhân', icon: UserCircle }] },
  ],
  student: [
    { section: 'TỔNG QUAN', items: [{ to: 'student/dashboard', label: 'Trang chủ học viên', icon: LayoutDashboard }] },
    {
      section: 'HỌC TẬP',
      items: [
        { to: 'student/my-classes', label: 'Lớp học của tôi', icon: BookOpen },
        { to: 'student/my-schedule', label: 'Lịch học', icon: Calendar },
        { to: 'student/my-attendance', label: 'Điểm danh của tôi', icon: ClipboardList },
      ],
    },
    {
      section: 'THI THỬ',
      items: [
        { to: 'student/mock-exams', label: 'Thi thử', icon: ClipboardCheck },
        { to: 'student/homework', label: 'Bài tập về nhà', icon: FileText },
      ],
    },
    {
      section: 'CÁ NHÂN',
      items: [
        { to: 'student/notifications', label: 'Thông báo', icon: Bell },
        { to: 'student/profile', label: 'Hồ sơ cá nhân', icon: UserCircle },
      ],
    },
  ],
};
