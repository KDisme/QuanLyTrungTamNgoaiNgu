import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Plus, Search, Trash2, Pencil, ClipboardList, FileCheck2, Save, UsersRound, Eye, EyeOff, CheckCircle2, XCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { classesApi, homeworkApi } from '../../api';
import { Badge, ConfirmDialog, EmptyState, Loading, Modal, StatusBadge } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

const QUESTION_TYPES = [
  { value: 'true_false', label: 'Đúng / Sai' },
  { value: 'multiple_choice_4', label: 'Trắc nghiệm 4 đáp án' },
  { value: 'essay', label: 'Tự luận' },
];

type HomeworkQuestion = {
  orderNumber: number;
  questionType: string;
  questionText: string;
  helpText: string;
  isRequired: boolean;
  score: number;
  correctAnswer: string;
  options: Array<{ label: string; text: string }>;
};

function createQuestion(type = 'multiple_choice_4', orderNumber = 1): HomeworkQuestion {
  return {
    orderNumber,
    questionType: type,
    questionText: '',
    helpText: '',
    isRequired: true,
    score: 1,
    correctAnswer: type === 'essay' ? '' : type === 'true_false' ? 'true' : 'A',
    options: type === 'multiple_choice_4'
      ? [
          { label: 'A', text: '' },
          { label: 'B', text: '' },
          { label: 'C', text: '' },
          { label: 'D', text: '' },
        ]
      : [],
  };
}

function HomeworkForm({ initial, onClose, onSuccess }: { initial?: any; onClose: () => void; onSuccess: () => void }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'config' | 'security'>('info');
  const [form, setForm] = useState<any>({
    title: initial?.title || '',
    description: initial?.description || '',
    instructions: initial?.instructions || '',
    classId: initial?.class_id || initial?.classId || '',
    dueDate: initial?.due_date ? String(initial.due_date).slice(0, 16) : '',
    allowLateSubmission: initial?.allow_late_submission ?? initial?.allowLateSubmission ?? false,
    totalScore: initial?.total_score || initial?.totalScore || 100,
    status: initial?.status || 'draft',
    showAnswersAfterSubmit: initial?.show_answers_after_submit ?? initial?.showAnswersAfterSubmit ?? false,
    showScoreAfterSubmit: initial?.show_score_after_submit ?? initial?.showScoreAfterSubmit ?? true,
    requirePassword: initial?.require_password ?? initial?.requirePassword ?? false,
    password: '',
    questions: initial?.questions?.length
      ? initial.questions.map((question: any, index: number) => ({
          orderNumber: question.order_number || question.orderNumber || index + 1,
          questionType: question.question_type || question.questionType || 'multiple_choice_4',
          questionText: question.question_text || question.questionText || '',
          helpText: question.help_text || question.helpText || '',
          isRequired: question.is_required ?? question.isRequired ?? true,
          score: question.score || 1,
          correctAnswer: question.correct_answer || question.correctAnswer || '',
          options: Array.isArray(question.options)
            ? question.options.map((option: any) => ({
                label: option.label || option.optionLabel,
                text: option.text || option.optionText || '',
              }))
            : [],
        }))
      : [createQuestion('multiple_choice_4', 1)],
  });

  useEffect(() => {
    classesApi.getAll({ limit: 200 }).then((res) => setClasses(res.data.classes || [])).catch(() => setClasses([]));
  }, []);

  const setQuestion = (index: number, patch: Partial<HomeworkQuestion>) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.map((question: HomeworkQuestion, questionIndex: number) => {
        if (questionIndex !== index) return question;
        return { ...question, ...patch };
      }),
    }));
  };

  const changeQuestionType = (index: number, type: string) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.map((question: HomeworkQuestion, questionIndex: number) => {
        if (questionIndex !== index) return question;
        return createQuestion(type, question.orderNumber);
      }),
    }));
  };

  const updateOption = (questionIndex: number, optionIndex: number, patch: Partial<{ label: string; text: string }>) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.map((question: HomeworkQuestion, index: number) => {
        if (index !== questionIndex) return question;
        return {
          ...question,
          options: question.options.map((option, currentIndex) => currentIndex === optionIndex ? { ...option, ...patch } : option),
        };
      }),
    }));
  };

  const addQuestion = () => {
    setForm((prev: any) => ({
      ...prev,
      questions: [...prev.questions, createQuestion('multiple_choice_4', prev.questions.length + 1)],
    }));
  };

  const removeQuestion = (index: number) => {
    setForm((prev: any) => ({
      ...prev,
      questions: prev.questions.filter((_: HomeworkQuestion, questionIndex: number) => questionIndex !== index),
    }));
  };

  const goNext = () => {
    if (tab === 'info') {
      if (!form.title.trim()) return toast.error('Vui lòng nhập tiêu đề bài tập');
      if (!form.questions.length) return toast.error('Vui lòng thêm ít nhất 1 câu hỏi');
      const emptyQuestion = form.questions.find((q: HomeworkQuestion) => !q.questionText.trim());
      if (emptyQuestion) return toast.error('Vui lòng nhập nội dung cho tất cả câu hỏi');
      setTab('config');
      return;
    }
    if (tab === 'config') {
      setTab('security');
    }
  };

  const submit = async () => {
    if (!form.title.trim()) return toast.error('Vui lòng nhập tiêu đề bài tập');
    if (!form.questions.length) return toast.error('Vui lòng thêm ít nhất 1 câu hỏi');
    if (form.requirePassword && !form.password.trim() && !(initial?.require_password || initial?.requirePassword)) {
      setTab('security');
      return toast.error('Vui lòng nhập mật khẩu cho bài tập');
    }

    const questions = form.questions.map((question: HomeworkQuestion, index: number) => ({
      orderNumber: index + 1,
      questionType: question.questionType,
      questionText: question.questionText,
      helpText: question.helpText,
      isRequired: question.isRequired,
      score: Number(question.score || 1),
      correctAnswer: question.correctAnswer,
      options: question.options,
    }));

    setSaving(true);
    try {
      const payload = {
        ...form,
        classId: form.classId ? Number(form.classId) : null,
        totalScore: Number(form.totalScore || 100),
        questions,
      };
      if (initial) await homeworkApi.update(initial.id, payload);
      else await homeworkApi.create(payload);
      toast.success('Đã lưu bài tập về nhà');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được bài tập');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Sửa bài tập về nhà' : 'Tạo bài tập về nhà'}
      size="xl"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {tab !== 'info' && (
              <button className="btn btn-secondary" onClick={() => setTab(tab === 'security' ? 'config' : 'info')}>Quay lại</button>
            )}
            {tab !== 'security' ? (
              <button className="btn btn-primary" onClick={goNext}>Tiếp theo</button>
            ) : (
              <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu bài tập'}</button>
            )}
          </div>
        </>
      )}
    >
      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-100)', paddingBottom: 0 }}>
        {[
          { id: 'info', label: 'Thông tin' },
          { id: 'config', label: 'Cấu hình' },
          { id: 'security', label: 'Bảo mật' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
              color: tab === t.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -2,
            }}>{t.label}</button>
        ))}
      </div>

      {tab === 'info' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Tiêu đề bài tập</label>
              <input className="form-input" value={form.title} onChange={(e) => setForm((prev: any) => ({ ...prev, title: e.target.value }))} placeholder="VD: Homework Unit 3 - Present Perfect" />
            </div>
            <div className="form-group">
              <label className="form-label">Lớp áp dụng</label>
              <select className="form-select" value={form.classId || ''} onChange={(e) => setForm((prev: any) => ({ ...prev, classId: e.target.value }))}>
                <option value="">Chọn lớp</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hạn nộp</label>
              <input type="datetime-local" className="form-input" value={form.dueDate} onChange={(e) => setForm((prev: any) => ({ ...prev, dueDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Điểm tối đa</label>
              <input type="number" className="form-input" value={form.totalScore} onChange={(e) => setForm((prev: any) => ({ ...prev, totalScore: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Trạng thái</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm((prev: any) => ({ ...prev, status: e.target.value }))}>
                <option value="draft">Nháp</option>
                <option value="active">Đang mở</option>
                <option value="closed">Đã đóng</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả ngắn</label>
            <textarea className="form-textarea" rows={2} value={form.description} onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))} placeholder="Mục tiêu, chương cần ôn, yêu cầu chung" />
          </div>

          <div className="form-group">
            <label className="form-label">Hướng dẫn làm bài</label>
            <textarea className="form-textarea" rows={3} value={form.instructions} onChange={(e) => setForm((prev: any) => ({ ...prev, instructions: e.target.value }))} placeholder="Mô tả đề, quy tắc làm bài, lưu ý nộp bài" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Danh sách câu hỏi</div>
              <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>Hỗ trợ True/False, trắc nghiệm 4 đáp án và tự luận.</div>
            </div>
            <button className="btn btn-secondary" onClick={addQuestion}><Plus size={14} /> Thêm câu</button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {form.questions.map((question: HomeworkQuestion, index: number) => (
              <div key={`${index}-${question.questionType}`} style={{ border: '1px solid var(--gray-200)', borderRadius: 14, padding: 14, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge variant="blue">Câu {index + 1}</Badge>
                    <select className="form-select" style={{ width: 240 }} value={question.questionType} onChange={(e) => changeQuestionType(index, e.target.value)}>
                      {QUESTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(index)} disabled={form.questions.length === 1}><Trash2 size={12} /> Xoá</button>
                </div>

                <div className="grid-2">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Nội dung câu hỏi</label>
                    <textarea className="form-textarea" rows={3} value={question.questionText} onChange={(e) => setQuestion(index, { questionText: e.target.value })} placeholder="Nhập câu hỏi, yêu cầu làm bài hoặc đề bài" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ghi chú / gợi ý</label>
                    <input className="form-input" value={question.helpText} onChange={(e) => setQuestion(index, { helpText: e.target.value })} placeholder="Gợi ý nếu cần" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Điểm</label>
                    <input type="number" className="form-input" value={question.score} onChange={(e) => setQuestion(index, { score: Number(e.target.value) })} />
                  </div>
                </div>

                {question.questionType === 'multiple_choice_4' && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {question.options.map((option, optionIndex) => (
                      <div key={option.label} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{option.label}</div>
                        <input className="form-input" value={option.text} onChange={(e) => updateOption(index, optionIndex, { text: e.target.value })} placeholder={`Đáp án ${option.label}`} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <input type="radio" name={`correct-${index}`} checked={question.correctAnswer === option.label} onChange={() => setQuestion(index, { correctAnswer: option.label })} />
                          Đúng
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {question.questionType === 'true_false' && (
                  <div className="grid-2" style={{ marginTop: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Đáp án đúng</label>
                      <select className="form-select" value={question.correctAnswer} onChange={(e) => setQuestion(index, { correctAnswer: e.target.value })}>
                        <option value="true">Đúng</option>
                        <option value="false">Sai</option>
                      </select>
                    </div>
                  </div>
                )}

                {question.questionType === 'essay' && (
                  <div className="alert alert-info" style={{ marginTop: 10 }}>
                    Câu tự luận không cần chọn đáp án đúng. Giáo viên sẽ chấm thủ công sau khi học viên nộp bài.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <label className="toggle-row" style={{ cursor: 'pointer' }}>
            <div className="toggle-row-text">
              <div className="toggle-row-title">Cho phép nộp muộn</div>
              <div className="toggle-row-desc">
                {form.allowLateSubmission
                  ? 'Bật: học viên vẫn nộp được bài sau khi quá hạn nộp.'
                  : 'Tắt: học viên không thể nộp bài sau khi quá hạn.'}
              </div>
            </div>
            <span className="toggle-switch">
              <input type="checkbox" checked={!!form.allowLateSubmission} onChange={(e) => setForm((prev: any) => ({ ...prev, allowLateSubmission: e.target.checked }))} />
              <span className="toggle-track" />
            </span>
          </label>

          <div className="toggle-row">
            <div className="toggle-row-text">
              <div className="toggle-row-title">Cho phép học viên xem đáp án sau khi nộp bài</div>
              <div className="toggle-row-desc">
                {form.showAnswersAfterSubmit
                  ? 'Bật: ngay sau khi nộp, học viên sẽ thấy đáp án đúng và biết câu nào đúng/sai.'
                  : 'Tắt: học viên không thấy đáp án đúng và không biết câu nào đúng/sai.'}
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!!form.showAnswersAfterSubmit}
                onChange={(e) => setForm((prev: any) => ({ ...prev, showAnswersAfterSubmit: e.target.checked }))}
              />
              <span className="toggle-track" />
            </label>
          </div>

          <div className="toggle-row">
            <div className="toggle-row-text">
              <div className="toggle-row-title">Cho phép học viên xem điểm sau khi nộp bài</div>
              <div className="toggle-row-desc">
                {form.showScoreAfterSubmit
                  ? 'Bật: học viên thấy điểm tổng và nhận xét ngay sau khi nộp/được chấm.'
                  : 'Tắt: học viên chỉ biết bài đã nộp/đã chấm, không thấy điểm số hay nhận xét.'}
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!!form.showScoreAfterSubmit}
                onChange={(e) => setForm((prev: any) => ({ ...prev, showScoreAfterSubmit: e.target.checked }))}
              />
              <span className="toggle-track" />
            </label>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="toggle-row">
            <div className="toggle-row-text">
              <div className="toggle-row-title">Yêu cầu mật khẩu để làm bài</div>
              <div className="toggle-row-desc">
                {form.requirePassword
                  ? 'Bật: học viên phải nhập đúng mật khẩu mới mở được đề bài (hữu ích khi thi tại lớp, tránh làm bài từ xa).'
                  : 'Tắt: học viên mở bài tập bình thường, không cần mật khẩu.'}
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!!form.requirePassword}
                onChange={(e) => setForm((prev: any) => ({ ...prev, requirePassword: e.target.checked }))}
              />
              <span className="toggle-track" />
            </label>
          </div>

          {form.requirePassword && (
            <div className="form-group">
              <label className="form-label">
                Mật khẩu bài tập {(initial?.require_password || initial?.requirePassword) ? '' : <span className="required">*</span>}
              </label>
              <input
                type="text"
                className="form-input"
                value={form.password}
                onChange={(e) => setForm((prev: any) => ({ ...prev, password: e.target.value }))}
                placeholder={(initial?.require_password || initial?.requirePassword) ? 'Để trống nếu không muốn đổi mật khẩu' : 'Nhập mật khẩu học viên sẽ dùng'}
              />
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
                Đọc mật khẩu này cho học viên trước giờ làm bài. Giáo viên/Admin luôn xem được đề mà không cần mật khẩu.
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
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
  const [scores, setScores] = useState<Record<number, number>>({});
  const [generalFeedback, setGeneralFeedback] = useState(student?.submissionFeedback || student?.feedback || '');
  const [saving, setSaving] = useState(false);
  const essayQuestions = questions.filter((question: any) => question.questionType === 'essay');
  const objectiveQuestions = questions.filter((question: any) => question.questionType !== 'essay');

  useEffect(() => {
    const nextScores: Record<number, number> = {};
    (submission?.submissionAnswers || []).forEach((answer: any) => {
      nextScores[Number(answer.questionId || answer.question_id)] = Number(answer.score || 0);
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

  const essayScore = useMemo(() => Object.values(scores).reduce((sum, value) => sum + Number(value || 0), 0), [scores]);

  const totalScore = objectiveScore + essayScore;

  const save = async () => {
    if (!submission?.submissionId) return toast.error('Bài này chưa có bài nộp để chấm');
    setSaving(true);
    try {
      const updatedAnswers = questions.map((question: any) => {
        const existing = answersByQuestion.get(Number(question.id)) || {};
        return {
          ...existing,
          questionId: question.id,
          score: Number(scores[Number(question.id)] || 0),
        };
      });
      await homeworkApi.grade(submission.submissionId, {
        totalScore,
        feedback: generalFeedback,
        answers: updatedAnswers,
      });
      toast.success('Đã lưu điểm bài tự luận');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được điểm');
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
          <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu điểm'}</button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="stats-grid">
          <div className="stat-card"><div><div className="stat-value">{student?.studentName || student?.full_name || ''}</div><div className="stat-label">HỌC VIÊN</div></div><UsersRound color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{totalScore}</div><div className="stat-label">TỔNG ĐIỂM</div></div><FileCheck2 color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{objectiveScore}</div><div className="stat-label">TRẮC NGHIỆM TỰ ĐỘNG</div></div><ClipboardList color="var(--primary)" /></div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 0 }}>
          Trắc nghiệm đã được chấm tự động. Giáo viên chỉ nhập điểm cho phần tự luận, sau đó hệ thống sẽ cộng vào tổng điểm.
        </div>

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
                        value={scores[Number(question.id)] ?? 0}
                        onChange={(e) => setScores((prev) => ({ ...prev, [Number(question.id)]: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gợi ý chấm</label>
                      <div className="form-input" style={{ minHeight: 42, display: 'flex', alignItems: 'center', color: 'var(--gray-500)' }}>
                        Ưu tiên chấm nội dung, bố cục, từ vựng và ngữ pháp.
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
                    <td>{student.submissionSubmittedAt || student.submitted_at ? new Date(student.submissionSubmittedAt || student.submitted_at).toLocaleString('vi-VN') : '-'}</td>
                    <td>
                      {student.submissionId ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setGradingStudent(student)}><FileCheck2 size={12} /> Chấm bài</button>
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
  const label = assignmentStatus === 'graded' || assignmentStatus === 'submitted' ? 'Xem bài' : 'Làm bài';
  return <button className="btn btn-primary btn-sm" onClick={() => navigate(`/${tenantSlug}/student/homework/${row.id}/take`)}>{label}</button>;
}

function getDisplayStatus(row: any, isStudentView: boolean) {
  if (isStudentView) return row.my_status || row.myStatus || row.status;
  return row.status;
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
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [gradingDetail, setGradingDetail] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

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

  const edit = async (row: any) => {
    const res = await homeworkApi.getById(row.id);
    setEditing(res.data);
  };

  const openGrading = async (row: any) => {
    const res = await homeworkApi.getById(row.id);
    setGradingDetail(res.data);
  };

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
        {canManage && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Tạo bài tập</button>}
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><div className="stat-value">{total}</div><div className="stat-label">BÀI TẬP</div></div><BookOpen color="var(--primary)" /></div>
        <div className="stat-card"><div><div className="stat-value">{stat.active || 0}</div><div className="stat-label">ĐANG MỞ</div></div><ClipboardList color="var(--primary)" /></div>
        <div className="stat-card"><div><div className="stat-value">{stat.graded || 0}</div><div className="stat-label">ĐÃ CHẤM</div></div><Calendar color="var(--primary)" /></div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <Search className="search-icon" size={14} />
          <input className="form-input" placeholder="Tìm tiêu đề, mô tả..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="active">Đang mở</option>
          <option value="closed">Đã đóng</option>
        </select>
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
                {!canManage && <th>Trạng thái của bạn</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={canManage ? 6 : 7}><EmptyState message="Chưa có bài tập về nhà" /></td></tr> : rows.map((row) => {
                const myStatus = row.my_status || row.myStatus;
                return (
                  <tr key={row.id}>
                    <td>
                      <b>{row.title}</b>
                      <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{row.description}</div>
                      {canManage && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(row.showAnswersAfterSubmit || row.show_answers_after_submit) ? (
                            <Badge variant="green"><Eye size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Hiện đáp án</Badge>
                          ) : (
                            <Badge variant="gray"><EyeOff size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Ẩn đáp án</Badge>
                          )}
                          {(row.showScoreAfterSubmit ?? row.show_score_after_submit ?? true) ? (
                            <Badge variant="blue"><CheckCircle2 size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Hiện điểm</Badge>
                          ) : (
                            <Badge variant="gray"><XCircle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Ẩn điểm</Badge>
                          )}
                          {(row.requirePassword || row.require_password) && (
                            <Badge variant="orange"><Lock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Có mật khẩu</Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{row.class_name || row.className || 'Chưa gán lớp'}</td>
                    <td>{row.question_count || row.questionCount || 0}</td>
                    <td>{row.due_date || row.dueDate ? String(row.due_date || row.dueDate).slice(0, 16).replace('T', ' ') : '-'}</td>
                    <td><StatusBadge status={getDisplayStatus(row, !canManage)} /></td>
                    {!canManage && <td>{myStatus ? <StatusBadge status={myStatus} /> : <Badge variant="gray">Chưa được giao</Badge>}</td>}
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {!canManage && <HomeworkSubmitButton row={row} tenantSlug={tenantSlug || ''} navigate={navigate} />}
                        {canManage && <button className="btn btn-primary btn-sm" onClick={() => openGrading(row)}><FileCheck2 size={12} /> Chấm bài</button>}
                        {canManage && <button className="btn btn-secondary btn-sm" onClick={() => edit(row)}><Pencil size={12} /> Sửa</button>}
                        {canManage && canDelete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(row)}><Trash2 size={12} /> Xoá</button>}
                        {canManage && !canDelete && <button className="btn btn-secondary btn-sm" onClick={() => edit(row)}><Pencil size={12} /> Xem</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <HomeworkForm onClose={() => setShowAdd(false)} onSuccess={load} />}
      {editing && <HomeworkForm initial={editing} onClose={() => setEditing(null)} onSuccess={load} />}
      {gradingDetail && <HomeworkDetailModal detail={gradingDetail} onClose={() => setGradingDetail(null)} onSuccess={load} />}
      {deleting && <ConfirmDialog message="Xoá bài tập này?" onCancel={() => setDeleting(null)} onConfirm={del} />}
    </div>
  );
}