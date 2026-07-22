import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, FileCheck2, Save, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { homeworkApi } from '../../../api';
import { Badge, Modal } from '../../../components/common';
import { formatDateTime, getLateDurationText } from '../utils/homeworkAssignments.helpers.ts';

export default function GradeStudentModal({
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