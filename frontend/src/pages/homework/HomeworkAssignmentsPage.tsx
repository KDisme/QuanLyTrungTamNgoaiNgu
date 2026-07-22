import React from 'react';
import { BookOpen, Calendar, ClipboardList, Eye, EyeOff, CheckCircle2, XCircle, Lock, Timer, FileEdit, FileCheck2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, ConfirmDialog, EmptyState, Loading, StatusBadge } from '../../components/common';
import { useHomeworkAssignments } from './hooks/useHomeworkAssignments';
import { formatDateTime, getDisplayStatus, getLateDurationText, getStudentHomeworkStatus } from './utils/homeworkAssignments.helpers';
import HomeworkDetailModal from './components/HomeworkDetailModal';
import HomeworkSubmitButton from './components/HomeworkSubmitButton';

const STUDENT_TABS = [
  { id: 'todo', label: 'Cần làm' },
  { id: 'submitted', label: 'Đã nộp' },
  { id: 'history', label: 'Lịch sử' },
] as const;

export default function HomeworkAssignmentsPage() {
  const {
    navigate,
    tenantSlug,
    canManage,
    canDelete,
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
    openGrading,
    reloadGradingDetail,
    del,
    stat,
  } = useHomeworkAssignments();

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Bài tập về nhà</h1>
          <p className="page-subtitle">Tạo homework như Google Forms: True/False, trắc nghiệm 4 đáp án và tự luận.</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => navigate('create')}><Plus size={15} /> Tạo bài tập</button>}
      </div>

      {canManage && (
        <div className="stats-grid">
          <div className="stat-card"><div><div className="stat-value">{total}</div><div className="stat-label">BÀI TẬP</div></div><BookOpen color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{stat.active || 0}</div><div className="stat-label">ĐANG MỞ</div></div><ClipboardList color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{stat.closed || 0}</div><div className="stat-label">ĐÃ ĐÓNG</div></div><Calendar color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{stat.draft || 0}</div><div className="stat-label">NHÁP</div></div><FileEdit color="var(--gray-500)" /></div>
        </div>
      )}

      {!canManage && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '2px solid var(--gray-100)' }}>
          {STUDENT_TABS.map((t) => (
            <button key={t.id} onClick={() => setStudentTab(t.id)}
              style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'var(--font)',
                color: studentTab === t.id ? 'var(--primary)' : 'var(--gray-500)',
                borderBottom: `2px solid ${studentTab === t.id ? 'var(--primary)' : 'transparent'}`,
                marginBottom: -2,
                transition: 'all 0.15s ease',
              }}>{t.label}</button>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <div className="search-input">
          <Search className="search-icon" size={14} />
          <input className="form-input" placeholder="Tìm tiêu đề, mô tả..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canManage && (
          <select className="form-select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="active">Đang mở</option>
            <option value="closed">Đã đóng</option>
          </select>
        )}
      </div>

      {loading ? <Loading /> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Lớp</th>
                <th>Câu hỏi</th>
                <th>Hạn nộp</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? <tr><td colSpan={6}><EmptyState message="Chưa có bài tập về nhà" /></td></tr> : displayedRows.map((row: any) => {
                return (
                  <tr key={row.id}>
                    <td>
                      <b>{row.title}</b>
                      <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{row.description}</div>

                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {!canManage && row.myAssignedAt && (new Date().getTime() - new Date(row.myAssignedAt).getTime()) < 24 * 60 * 60 * 1000 && (
                          <Badge variant="green">Mới</Badge>
                        )}

                        {!canManage && !row.mySubmittedAt && row.dueDate && (new Date(row.dueDate).getTime() - new Date().getTime()) > 0 && (new Date(row.dueDate).getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000 && (
                          <Badge variant="red">Sắp đến hạn</Badge>
                        )}

                        {canManage && ((row.showAnswersAfterSubmit || row.show_answers_after_submit) ? (
                          <Badge variant="green"><Eye size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Hiện đáp án</Badge>
                        ) : (
                          <Badge variant="gray"><EyeOff size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Ẩn đáp án</Badge>
                        ))}
                        {canManage && ((row.showScoreAfterSubmit ?? row.show_score_after_submit ?? true) ? (
                          <Badge variant="blue"><CheckCircle2 size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Hiện điểm</Badge>
                        ) : (
                          <Badge variant="gray"><XCircle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Ẩn điểm</Badge>
                        ))}
                        {canManage && (row.requirePassword || row.require_password) && (
                          <Badge variant="orange"><Lock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Có mật khẩu</Badge>
                        )}
                        {canManage && (row.timeLimitMinutes || row.time_limit_minutes) && (
                          <Badge variant="purple"><Timer size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{row.timeLimitMinutes || row.time_limit_minutes} phút</Badge>
                        )}
                        {(row.allowLateSubmission || row.allow_late_submission) && (
                          <Badge variant="yellow"><Calendar size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Cho phép nộp muộn</Badge>
                        )}
                      </div>

                      {!canManage && (row.myStatus || row.my_status) === 'revision_required' && (row.myFeedback || row.feedback) && (
                        <div style={{ color: '#d97706', fontSize: 12, marginTop: 6, fontWeight: 700, background: '#fffbeb', border: '1px dashed #fef3c7', borderRadius: 8, padding: '6px 10px', display: 'inline-block' }}>
                          ✍️ Giáo viên yêu cầu làm lại: "{row.myFeedback || row.feedback}"
                        </div>
                      )}
                    </td>
                    <td>{row.class_name || row.className || 'Chưa gán lớp'}</td>
                    <td>{row.question_count || row.questionCount || 0}</td>
                    <td>{row.due_date || row.dueDate ? formatDateTime(row.due_date || row.dueDate) : '-'}</td>
                    <td>
                      <StatusBadge status={canManage ? getDisplayStatus(row, false) : getStudentHomeworkStatus(row)} />
                      {!canManage && ['submitted', 'graded'].includes(String(row.myStatus || '').toLowerCase()) && row.mySubmittedAt && row.dueDate && new Date(row.mySubmittedAt) > new Date(row.dueDate) && (
                        <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                          ({getLateDurationText(row.mySubmittedAt, row.dueDate)})
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {!canManage && <HomeworkSubmitButton row={row} tenantSlug={tenantSlug || ''} navigate={navigate} />}
                        {canManage && <button className="btn btn-primary btn-sm" onClick={() => openGrading(row)}><FileCheck2 size={12} /> Chấm bài</button>}
                        {canManage && <button className="btn btn-secondary btn-sm" onClick={() => navigate(`${row.id}/edit`)}><Pencil size={12} /> Sửa</button>}
                        {canManage && canDelete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(row)}><Trash2 size={12} /> Xoá</button>}
                        {canManage && !canDelete && <button className="btn btn-secondary btn-sm" onClick={() => navigate(`${row.id}/edit`)}><Pencil size={12} /> Xem</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {gradingDetail && <HomeworkDetailModal detail={gradingDetail} onClose={() => setGradingDetail(null)} onSuccess={reloadGradingDetail} />}
      {deleting && <ConfirmDialog message="Xoá bài tập này?" onCancel={() => setDeleting(null)} onConfirm={del} />}
    </div>
  );
}