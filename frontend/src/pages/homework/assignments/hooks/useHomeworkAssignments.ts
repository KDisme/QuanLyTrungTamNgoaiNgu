import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { homeworkApi } from '../../../../api';
import { useAuth } from '../../../../hooks/useAuth';
import { getDisplayStatus, getStudentHomeworkTab } from '../../assignments/utils/homeworkAssignments.helpers.ts';

export function useHomeworkAssignments() {
  const { user, tenantSlug } = useAuth();
  const navigate = useNavigate();
  const roles = user?.roles || [];
  const canManage = roles.includes('admin') || roles.includes('teacher');
  const canDelete = roles.includes('admin') || roles.includes('teacher');

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [gradingDetail, setGradingDetail] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [studentTab, setStudentTab] = useState<'todo' | 'submitted' | 'history'>('todo');

  const displayedRows = useMemo(() => {
    if (canManage) return rows;
    return rows.filter((row) => getStudentHomeworkTab(row) === studentTab);
  }, [rows, canManage, studentTab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await homeworkApi.getAll({ search, status: status || undefined, limit: 200 });
      setRows(res.data.homeworkAssignments || []);
      setTotal(res.data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  const openGrading = async (row: any) => {
    const res = await homeworkApi.getById(row.id);
    setGradingDetail(res.data);
  };

  const reloadGradingDetail = useCallback(async () => {
    // Reload cả danh sách lẫn detail đang mở để cập nhật điểm học viên mới nhất
    load();
    if (gradingDetail?.id) {
      try {
        const res = await homeworkApi.getById(gradingDetail.id);
        setGradingDetail(res.data);
      } catch {
        // ignore—giữ nguyên detail cũ nếu lỗi
      }
    }
  }, [load, gradingDetail?.id]);

  const del = async () => {
    await homeworkApi.delete(deleting.id);
    toast.success('Đã xoá bài tập');
    setDeleting(null);
    load();
  };

  const stat = useMemo(() => rows.reduce((acc: any, item: any) => {
    const key = getDisplayStatus(item, !canManage);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [rows]);

  return {
    navigate,
    tenantSlug,
    canManage,
    canDelete,
    rows,
    total,
    loading,
    search,
    setSearch,
    status,
    setStatus,
    gradingDetail,
    setGradingDetail,
    deleting,
    setDeleting,
    studentTab,
    setStudentTab,
    displayedRows,
    load,
    openGrading,
    reloadGradingDetail,
    del,
    stat,
  };
}