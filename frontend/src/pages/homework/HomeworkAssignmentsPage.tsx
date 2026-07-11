import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Plus, Search, Trash2, Pencil, ClipboardList, FileCheck2, Save, UsersRound, Eye, EyeOff, CheckCircle2, XCircle, Lock, Timer, FileEdit } from 'lucide-react';
import toast from 'react-hot-toast';
import { homeworkApi } from '../../api';
import { Badge, ConfirmDialog, EmptyState, Loading, Modal, StatusBadge } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function GradeStudentModal({
  detail,
  student,
  onClose,
  onSuccess,
}: {
  detail: any;
  student: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const questions = detail?.questions || [];
  const submission = student?.submissionId ? student : null;
  const [scores, setScores] = useState<Record<number, string | number>>({});
  const [generalFeedback, setGeneralFeedback] = useState(student?.submissionFeedback || student?.feedback || '');
  const [saving, setSaving] = useState(false);

  const [publishScore, setPublishScore] = useState(!!detail?.showScoreAfterSubmit);
  const [publishAnswers, setPublishAnswers] = useState(!!detail?.showAnswersAfterSubmit);

  const togglePublishScore = async (checked: boolean) => {
    setPublishScore(checked);
    try {
      await homeworkApi.update(detail.id, {
        ...detail,
        showScoreAfterSubmit: checked,
      });
      toast.success(checked ? 'Đã công bố điểm cho cả lớp' : 'Đã ẩn điểm với cả lớp');
      detail.showScoreAfterSubmit = checked;
      onSuccess();
    } catch (err) {
      toast.error('Không cập nhật được cấu hình');
      setPublishScore(!checked);
    }
  };

  const togglePublishAnswers = async (checked: boolean) => {
    setPublishAnswers(checked);
    try {
      await homeworkApi.update(detail.id, {
        ...detail,
        showAnswersAfterSubmit: checked,
      });
      toast.success(checked ? 'Đã công bố đáp án cho cả lớp' : 'Đã ẩn đáp án với cả lớp');
      detail.showAnswersAfterSubmit = checked;
      onSuccess();
    } catch (err) {
      toast.error('Không cập nhật được cấu hình');
      setPublishAnswers(!checked);
    }
  };
  const essayQuestions = useMemo(() => questions.filter((question: any) => question.questionType === 'essay'), [questions]);
  const objectiveQuestions = useMemo(() => questions.filter((question: any) => question.questionType !== 'essay'), [questions]);

  useEffect(() => {
    const nextScores: Record<number, string | number> = {};
    // Chỉ load điểm cho câu tự luận (essay), không copy điểm trắc nghiệm tự động
    (submission?.submissionAnswers || []).forEach((answer: any) => {
      const qId = Number(answer.questionId || answer.question_id);
      const isEssay = essayQuestions.some((q: any) => Number(q.id) === qId);
      if (isEssay) {
        nextScores[qId] = answer.score ?? 0;
      }
    });
    essayQuestions.forEach((question: any) => {
      if (nextScores[Number(question.id)] === undefined) {
        nextScores[Number(question.id)] = 0;
      }
    });
    setScores(nextScores);
  }, [essayQuestions, submission]);

  const answersByQuestion = useMemo(() => new Map<number, any>((submission?.submissionAnswers || []).map((answer: any) => [Number(answer.questionId || answer.question_id), answer])), [submission]);

  const objectiveScore = useMemo(() => {
    return objectiveQuestions.reduce((sum: number, question: any) => {
      const answer: any = answersByQuestion.get(Number(question.id));
      return sum + Number(answer?.score || 0);
    }, 0);
  }, [answersByQuestion, objectiveQuestions]);

  const essayScore = useMemo(() => Object.values(scores).reduce((sum: number, value) => sum + Number(value || 0), 0), [scores]);

  const totalScore = objectiveScore + essayScore;

  const save = async (requestRevision = false) => {
    if (!submission?.submissionId) return toast.error('Bài này chưa có bài nộp để chấm');
    setSaving(true);
    try {
      const updatedAnswers = questions.map((question: any) => {
        const existing = answersByQuestion.get(Number(question.id)) || {};
        const isEssay = question.questionType === 'essay';
        return {
          ...existing,
          questionId: question.id,
          // Câu tự luận: lấy điểm giáo viên nhập; câu trắc nghiệm: giữ nguyên điểm tự động
          score: isEssay
            ? Number(scores[Number(question.id)] || 0)
            : Number(existing.score || 0),
        };
      });
      await homeworkApi.grade(submission.submissionId, {
        totalScore,
        feedback: generalFeedback,
        answers: updatedAnswers,
        requestRevision,
      });
      toast.success(requestRevision ? 'Đã yêu cầu học viên làm lại bài' : 'Đã lưu điểm bài tự luận');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được kết quả');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Chấm bài - ${student?.studentName || student?.full_name || ''}`}
      size="xl"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-warning" style={{ background: '#d97706', borderColor: '#d97706', color: 'white' }} onClick={() => save(true)} disabled={saving}>
              Yêu cầu làm lại
            </button>
            <button className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
              <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu điểm'}
            </button>
          </div>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="stats-grid">
          <div className="stat-card"><div><div className="stat-value">{student?.studentName || student?.full_name || ''}</div><div className="stat-label">HỌC VIÊN</div></div><UsersRound color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{totalScore}</div><div className="stat-label">TỔNG ĐIỂM</div></div><FileCheck2 color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{objectiveScore}</div><div className="stat-label">TRẮC NGHIỆM TỰ ĐỘNG</div></div><ClipboardList color="var(--primary)" /></div>
        </div>

        <div style={{ display: 'flex', gap: 24, padding: 12, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-700)' }}>CÔNG BỐ BÀI TẬP (CẢ LỚP):</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={publishScore} onChange={(e) => togglePublishScore(e.target.checked)} />
            Hiện điểm số
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={publishAnswers} onChange={(e) => togglePublishAnswers(e.target.checked)} />
            Hiện đáp án đúng/sai
          </label>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 0 }}>
          Trắc nghiệm đã được chấm tự động. Giáo viên chỉ nhập điểm cho phần tự luận, sau đó hệ thống sẽ cộng vào tổng điểm.
        </div>

        {submission?.submissionSubmittedAt && detail?.dueDate && new Date(submission.submissionSubmittedAt) > new Date(detail.dueDate) && (
          <div className="alert alert-danger" style={{ marginBottom: 0, background: '#fff1f2', color: '#991b1b', borderColor: '#ffe4e6' }}>
            ⏱️ <strong>Nộp bài muộn:</strong> Học viên nộp bài lúc {formatDateTime(submission.submissionSubmittedAt)} ({getLateDurationText(submission.submissionSubmittedAt, detail.dueDate)}).
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {questions.map((question: any, index: number) => {
            const ans: any = answersByQuestion.get(Number(question.id));
            const maxScore = Number(question.score || 1);
            const isEssay = question.questionType === 'essay';
            return (
              <div key={question.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 14, padding: 14, background: 'white' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                  <Badge variant="gray">Câu {index + 1}</Badge>
                  <Badge variant={question.questionType === 'essay' ? 'orange' : 'purple'}>{question.questionType}</Badge>
                  <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>Tối đa {maxScore} điểm</span>
                </div>
                <div style={{ fontWeight: 700, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{question.questionText}</div>
                <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Bài làm của học viên</div>
                  {ans?.answerText ? <div style={{ whiteSpace: 'pre-wrap' }}>{ans.answerText}</div> : <div style={{ color: 'var(--gray-500)' }}>{ans?.selectedAnswer || ans?.selected_answer || 'Chưa có câu trả lời'}</div>}
                </div>
                {isEssay ? (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Điểm tự luận</label>
                      <input
                        type="number"
                        min={0}
                        max={maxScore}
                        step="0.5"
                        className="form-input"
                        value={scores[Number(question.id)] ?? ''}
                        onChange={(e) => setScores((prev) => ({ ...prev, [Number(question.id)]: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gợi ý chấm</label>
                      <div className="form-input" style={{ minHeight: 42, display: 'flex', alignItems: 'center', color: 'var(--gray-500)' }}>
                        {question.helpText || 'Giáo viên chưa nhập gợi ý chấm cho câu này'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Điểm tự động</label>
                      <div className="form-input" style={{ minHeight: 42, display: 'flex', alignItems: 'center' }}>
                        {Number(ans?.score || 0)} / {maxScore}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kết quả</label>
                      <div className="form-input" style={{ minHeight: 42, display: 'flex', alignItems: 'center', color: ans?.isCorrect ? 'var(--success)' : 'var(--danger)' }}>
                        {ans?.isCorrect ? 'Đúng' : 'Sai'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="form-group">
          <label className="form-label">Nhận xét tổng bài</label>
          <textarea className="form-textarea" rows={4} value={generalFeedback} onChange={(e) => setGeneralFeedback(e.target.value)} placeholder="Nhận xét chung hiển thị cho học viên sau khi chấm" />
        </div>
      </div>
    </Modal>
  );
}

function HomeworkDetailModal({
  detail,
  onClose,
  onSuccess,
}: {
  detail: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [gradingStudent, setGradingStudent] = useState<any>(null);
  const students = detail?.students || [];

  return (
    <>
      <Modal title={`Chấm bài - ${detail?.title || ''}`} size="xl" onClose={onClose}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="grid-2">
            <div className="stat-card"><div><div className="stat-value">{detail?.className || detail?.class_name || '-'}</div><div className="stat-label">LỚP</div></div><UsersRound color="var(--primary)" /></div>
            <div className="stat-card"><div><div className="stat-value">{students.length}</div><div className="stat-label">HỌC VIÊN ĐƯỢC GÁN</div></div><ClipboardList color="var(--primary)" /></div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Trạng thái</th>
                  <th>Điểm</th>
                  <th>Nộp lúc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState message="Chưa có học viên nào trong bài tập" /></td></tr>
                ) : students.map((student: any) => (
                  <tr key={student.assignmentStudentId || student.id}>
                    <td>
                      <b>{student.studentName || student.full_name}</b>
                      <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{student.studentEmail || student.email}</div>
                    </td>
                    <td><StatusBadge status={student.submissionStatus || student.submission_status || student.myStatus || student.status} /></td>
                    <td>{student.submissionTotalScore ?? student.total_score ?? '-'}</td>
                    <td>
                      {student.submissionSubmittedAt || student.submitted_at ? (
                        <>
                          <div>{formatDateTime(student.submissionSubmittedAt || student.submitted_at)}</div>
                          {detail?.dueDate && new Date(student.submissionSubmittedAt || student.submitted_at) > new Date(detail.dueDate) && (
                            <div style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                              ({getLateDurationText(student.submissionSubmittedAt || student.submitted_at, detail.dueDate)})
                            </div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {student.submissionId ? (
                        (student.submissionStatus || student.submission_status) === 'graded' ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => setGradingStudent(student)}><FileCheck2 size={12} /> Xem bài</button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => setGradingStudent(student)}><FileCheck2 size={12} /> Chấm bài</button>
                        )
                      ) : (
                        <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>Chưa nộp</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {gradingStudent && <GradeStudentModal detail={detail} student={gradingStudent} onClose={() => setGradingStudent(null)} onSuccess={onSuccess} />}
    </>
  );
}

function HomeworkSubmitButton({ row, tenantSlug, navigate }: { row: any; tenantSlug: string; navigate: ReturnType<typeof useNavigate> }) {
  const assignmentStatus = row.my_status || row.myStatus || row.status;
  const isViewOnly = assignmentStatus === 'graded' || assignmentStatus === 'submitted';
  const label = isViewOnly ? 'Xem bài' : 'Làm bài';

  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    const timeLimit = Number(row.timeLimitMinutes || row.time_limit_minutes || 0);
    const hasStarted = !!(row.myStartedAt || row.my_started_at);

    if (timeLimit > 0 && !hasStarted && !isViewOnly) {
      setShowConfirm(true);
    } else {
      navigate(`/${tenantSlug}/student/homework/${row.id}/take`);
    }
  };

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={handleClick}>{label}</button>

      {showConfirm && (
        <Modal
          title="⏱️ Xác nhận bắt đầu làm bài"
          size="md"
          onClose={() => setShowConfirm(false)}
          footer={(
            <>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={() => {
                setShowConfirm(false);
                navigate(`/${tenantSlug}/student/homework/${row.id}/take`);
              }}>Bắt đầu làm bài</button>
            </>
          )}
        >
          <div style={{ display: 'grid', gap: 14, padding: '10px 0' }}>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              Bài tập này có giới hạn thời gian làm bài là <strong style={{ color: 'var(--primary)', fontSize: 17 }}>{row.timeLimitMinutes || row.time_limit_minutes} phút</strong>.
            </div>
            <div style={{ fontSize: 14, color: '#991b1b', background: '#fff1f2', border: '1px solid #ffe4e6', borderRadius: 8, padding: 12, lineHeight: 1.5 }}>
              ⚠️ <strong>Lưu ý quan trọng:</strong> Khi bạn nhấn bắt đầu, đồng hồ đếm ngược sẽ chạy liên tục và <strong>không thể tạm dừng hoặc đặt lại</strong>, kể cả khi bạn đóng tab trình duyệt hay thoát ra ngoài. Hãy chắc chắn bạn đã chuẩn bị sẵn sàng và có kết nối mạng ổn định!
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function getLateDurationText(submittedAt: any, dueDate: any) {
  if (!submittedAt || !dueDate) return '';
  const diffMs = new Date(submittedAt).getTime() - new Date(dueDate).getTime();
  if (diffMs <= 0) return '';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `muộn ${diffMinutes} phút`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return `muộn ${diffHours} giờ ${remainingMinutes > 0 ? `${remainingMinutes} phút` : ''}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  return `muộn ${diffDays} ngày ${remainingHours > 0 ? `${remainingHours} giờ` : ''}`;
}

function getDisplayStatus(row: any, isStudentView: boolean) {
  if (row.status === 'active') {
    const dueDate = row.dueDate || row.due_date;
    const allowLate = row.allowLateSubmission || row.allow_late_submission;
    if (dueDate && new Date() > new Date(dueDate) && !allowLate) {
      return 'closed';
    }
  }
  return row.status;
}

function getStudentHomeworkStatus(row: any) {
  const myStatus = row.myStatus || row.my_status;
  const mySubmittedAt = row.mySubmittedAt || row.my_submitted_at;
  const myStartedAt = row.myStartedAt || row.my_started_at;
  const dueDate = row.dueDate || row.due_date;
  const allowLate = row.allowLateSubmission || row.allow_late_submission;

  if (mySubmittedAt || ['submitted', 'graded'].includes(String(myStatus || '').toLowerCase())) {
    if (myStatus === 'graded') {
      return 'graded'; // Đã chấm
    }
    if (dueDate && new Date(mySubmittedAt || Date.now()) > new Date(dueDate)) {
      return 'submitted_late'; // Nộp muộn
    }
    return 'submitted'; // Đang chờ chấm
  }

  // Chưa nộp
  const now = new Date();
  if (dueDate && now > new Date(dueDate)) {
    if (allowLate) {
      return myStartedAt || myStatus === 'in_progress' ? 'in_progress' : 'assigned';
    }
    return 'missed'; // Quá hạn
  }

  if (myStatus === 'revision_required') {
    return 'revision_required'; // Cần làm lại
  }

  return myStartedAt || myStatus === 'in_progress' ? 'in_progress' : 'assigned';
}

function getStudentHomeworkTab(row: any): 'todo' | 'submitted' | 'history' {
  const status = getStudentHomeworkStatus(row);
  if (['assigned', 'in_progress', 'revision_required'].includes(status)) {
    return 'todo';
  }
  if (['submitted', 'submitted_late'].includes(status)) {
    return 'submitted';
  }
  return 'history'; // 'graded', 'missed'
}

export default function HomeworkAssignmentsPage() {
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
          {[
            { id: 'todo', label: 'Cần làm' },
            { id: 'submitted', label: 'Đã nộp' },
            { id: 'history', label: 'Lịch sử' },
          ].map((t) => (
            <button key={t.id} onClick={() => setStudentTab(t.id as any)}
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
              {displayedRows.length === 0 ? <tr><td colSpan={6}><EmptyState message="Chưa có bài tập về nhà" /></td></tr> : displayedRows.map((row) => {
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