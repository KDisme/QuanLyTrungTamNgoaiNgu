import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, XCircle, Clock3, Send, Sparkles, Eye, EyeOff, MessageSquare, Lock, KeyRound, Timer, AlarmClockOff } from 'lucide-react';
import { homeworkApi } from '../../api';
import { Badge, EmptyState, Loading, StatusBadge } from '../../components/common';

type AnswerState = Record<number, { answerText?: string; selectedAnswer?: string }>;
type ResultState = Record<number, { isCorrect?: boolean; score?: number }>;

function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="hw-progress-ring-wrap">
      <div
        style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: `conic-gradient(var(--primary) ${clamped * 3.6}deg, var(--gray-200) 0deg)`,
          display: 'grid', placeItems: 'center',
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px var(--gray-100)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{clamped}%</div>
            <div style={{ fontSize: 9, color: 'var(--gray-500)', fontWeight: 700, letterSpacing: 0.4 }}>HOÀN THÀNH</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeworkTakePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const assignmentId = Number(id);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [results, setResults] = useState<ResultState>({});
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedPassword, setVerifiedPassword] = useState<string | undefined>(undefined);
  const [timeUp, setTimeUp] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const autoSubmittedRef = useRef(false);

  const load = async (password?: string) => {
    setLoading(true);
    try {
      const res = await homeworkApi.getById(assignmentId, password);
      const item = res.data;
      setDetail(item);
      setNeedsPassword(false);
      setPasswordError('');
      setTimeUp(false);
      setSecondsLeft(typeof item.remainingSeconds === 'number' ? item.remainingSeconds : null);
      if (password) setVerifiedPassword(password);

      const submission = item.mySubmission || item.students?.[0] || null;
      const initialAnswers: AnswerState = {};
      const initialResults: ResultState = {};
      (submission?.answers || submission?.submissionAnswers || []).forEach((answer: any) => {
        const qId = Number(answer.questionId || answer.question_id);
        initialAnswers[qId] = {
          answerText: answer.answerText || answer.answer_text || '',
          selectedAnswer: answer.selectedAnswer || answer.selected_answer || '',
        };
        if (answer.isCorrect !== undefined || answer.score !== undefined) {
          initialResults[qId] = { isCorrect: answer.isCorrect, score: answer.score };
        }
      });
      setAnswers(initialAnswers);
      setResults(initialResults);
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'PASSWORD_REQUIRED' || code === 'INVALID_PASSWORD') {
        setNeedsPassword(true);
        setPasswordError(code === 'INVALID_PASSWORD' ? 'Sai mật khẩu, vui lòng thử lại.' : '');
      } else if (code === 'TIME_UP') {
        setTimeUp(true);
      } else {
        toast.error(err.response?.data?.message || 'Không tải được bài tập');
      }
    } finally {
      setLoading(false);
    }
  };

  const unlock = async () => {
    if (!passwordInput.trim()) return;
    setVerifying(true);
    try {
      await load(passwordInput.trim());
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => { load(); }, [assignmentId]);

  const questions = detail?.questions || [];
  const myStatus = detail?.mySubmission?.submissionStatus || detail?.mySubmission?.myStatus || detail?.myStatus || detail?.status;
  const canEdit = !['submitted', 'graded'].includes(String(myStatus || '').toLowerCase());
  const isLocked = !canEdit;
  // Backend already strips correctAnswer / per-question score when reveal isn't allowed,
  // so the presence of a correctAnswer or a scored result is itself the signal to trust here.
  const canRevealAnswers = !!detail?.canRevealAnswers;
  const canRevealScore = !!detail?.canRevealScore;

  const setAnswer = (questionId: number, patch: Partial<{ answerText: string; selectedAnswer: string }>) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), ...patch } }));
  };

  const submit = async (auto = false) => {
    const payloadAnswers = questions.map((question: any) => {
      const answer = answers[Number(question.id)] || {};
      if (question.questionType === 'essay') {
        return { questionId: question.id, answerText: answer.answerText || '' };
      }
      return { questionId: question.id, selectedAnswer: answer.selectedAnswer || '' };
    });

    if (!auto) {
      const missing = questions.filter((question: any) => {
        const answer = answers[Number(question.id)] || {};
        if (question.questionType === 'essay') return !(answer.answerText || '').trim();
        return !(answer.selectedAnswer || '').trim();
      });
      if (missing.length) return toast.error('Vui lòng trả lời đầy đủ các câu hỏi trước khi nộp');
    }

    setSaving(true);
    try {
      await homeworkApi.submit(assignmentId, { answers: payloadAnswers, password: verifiedPassword });
      toast.success(auto ? 'Đã hết giờ, hệ thống tự động nộp bài của bạn' : 'Đã nộp bài tập');
      await load(verifiedPassword);
    } catch (err: any) {
      if (err.response?.data?.code === 'TIME_UP') {
        setTimeUp(true);
      } else {
        toast.error(err.response?.data?.message || 'Không nộp được bài');
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (secondsLeft === null || !canEdit) return;
    if (secondsLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submit(true);
      }
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, canEdit]);

  const submission = detail?.mySubmission || detail?.students?.find((student: any) => student.studentId === detail?.student_id) || null;

  const scoreSummary = useMemo(() => {
    if (!submission) return null;
    return {
      totalScore: submission.submissionTotalScore ?? submission.myTotalScore ?? submission.total_score ?? 0,
      status: submission.submissionStatus || submission.myStatus || submission.status,
      feedback: submission.submissionFeedback || submission.myFeedback || submission.feedback || '',
    };
  }, [submission]);

  if (timeUp) {
    return (
      <div style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}><ArrowLeft size={14} /> Quay lại</button>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--danger-light)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
          <AlarmClockOff color="var(--danger)" size={28} />
        </div>
        <h2 style={{ margin: '0 0 6px' }}>Đã hết thời gian làm bài</h2>
        <p style={{ color: 'var(--gray-500)' }}>Thời gian làm bài đã kết thúc, bạn không thể vào làm bài này nữa. Nếu bài đã kịp nộp trước đó, hãy liên hệ giáo viên để xem lại kết quả.</p>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}><ArrowLeft size={14} /> Quay lại</button>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--primary-light)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
          <Lock color="var(--primary)" size={28} />
        </div>
        <h2 style={{ margin: '0 0 6px' }}>Bài tập yêu cầu mật khẩu</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: 20 }}>Nhập mật khẩu giáo viên đã cung cấp để bắt đầu làm bài.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            className="form-input"
            placeholder="Mật khẩu bài tập"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
            autoFocus
          />
          <button className="btn btn-primary" onClick={unlock} disabled={verifying || !passwordInput.trim()}>
            <KeyRound size={14} /> {verifying ? 'Đang mở...' : 'Mở bài'}
          </button>
        </div>
        {passwordError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10, textAlign: 'left' }}>{passwordError}</div>}
      </div>
    );
  }

  if (loading) return <Loading />;
  if (!detail) return <EmptyState message="Không tìm thấy bài tập" />;

  const totalQuestions = questions.length;
  const answeredCount = questions.filter((question: any) => {
    const current = answers[Number(question.id)] || {};
    if (question.questionType === 'essay') return !!String(current.answerText || '').trim();
    return !!String(current.selectedAnswer || '').trim();
  }).length;
  const completionRate = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const deadlineText = detail.dueDate ? new Date(detail.dueDate).toLocaleString('vi-VN') : 'Không có hạn nộp';

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 1120, margin: '0 auto', paddingBottom: 88 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Quay lại</button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge variant="blue">{detail.className || detail.class_name || 'Chưa gán lớp'}</Badge>
          <StatusBadge status={detail.status} />
          {isLocked && <Badge variant="green">Đã nộp</Badge>}
        </div>
      </div>

      <section style={{ borderRadius: 24, padding: 24, background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%)', border: '1px solid var(--gray-200)', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr auto 1fr', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 12, marginBottom: 12 }}>
              <Sparkles size={14} /> Homework
            </div>
            <h1 className="page-title" style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>{detail.title}</h1>
            <p className="page-subtitle" style={{ marginTop: 10, maxWidth: 860 }}>{detail.description || 'Bài tập về nhà do giáo viên giao'}</p>
            {detail.instructions && <div className="alert alert-info" style={{ marginTop: 18, whiteSpace: 'pre-wrap' }}>{detail.instructions}</div>}
          </div>

          {!isLocked && <ProgressRing percent={completionRate} />}

          <div style={{ display: 'grid', gap: 12 }}>
            {secondsLeft !== null && canEdit && (
              <div className="stat-card" style={{ minHeight: 96, background: secondsLeft <= 60 ? 'var(--danger-light)' : undefined, borderColor: secondsLeft <= 60 ? '#fecaca' : undefined }}>
                <div>
                  <div className="stat-value" style={{ color: secondsLeft <= 60 ? 'var(--danger)' : undefined, fontVariantNumeric: 'tabular-nums' }}>
                    {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                  </div>
                  <div className="stat-label">THỜI GIAN CÒN LẠI</div>
                </div>
                <Timer color={secondsLeft <= 60 ? 'var(--danger)' : 'var(--primary)'} />
              </div>
            )}
            <div className="stat-card" style={{ minHeight: 96 }}>
              <div>
                <div className="stat-value">{deadlineText}</div>
                <div className="stat-label">HẠN NỘP</div>
              </div>
              <Clock3 color="var(--primary)" />
            </div>
            <div className="stat-card" style={{ minHeight: 96 }}>
              <div>
                <div className="stat-value">{totalQuestions} câu</div>
                <div className="stat-label">SỐ CÂU HỎI</div>
              </div>
              {canRevealAnswers ? <Eye color="var(--success)" /> : <EyeOff color="var(--gray-400)" />}
            </div>
          </div>
        </div>
      </section>

      {scoreSummary && (
        <section style={{ borderRadius: 20, padding: 20, background: '#fff', border: '1px solid var(--gray-200)', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--primary-light)', display: 'grid', placeItems: 'center' }}>
                <CheckCircle2 color="var(--primary)" size={26} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', letterSpacing: 0.4 }}>ĐIỂM CỦA BẠN</div>
                {canRevealScore ? (
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{scoreSummary.totalScore} <span style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600 }}>/ {detail.totalScore ?? 100}</span></div>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-500)' }}>Chưa công bố</div>
                )}
              </div>
            </div>
            <StatusBadge status={scoreSummary.status || myStatus} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: canRevealScore ? 'var(--primary-light)' : 'var(--gray-50)', color: canRevealScore ? 'var(--primary-dark)' : 'var(--gray-600)', fontSize: 13, fontWeight: 600 }}>
            {canRevealScore ? <Eye size={15} /> : <EyeOff size={15} />}
            {canRevealScore
              ? 'Giáo viên cho phép xem điểm — điểm và nhận xét hiển thị ngay khi có.'
              : 'Giáo viên chưa công bố điểm cho bài này. Bạn sẽ được thông báo khi có điểm.'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: canRevealAnswers ? 'var(--success-light)' : 'var(--gray-50)', color: canRevealAnswers ? '#059669' : 'var(--gray-600)', fontSize: 13, fontWeight: 600 }}>
            {canRevealAnswers ? <Eye size={15} /> : <EyeOff size={15} />}
            {canRevealAnswers
              ? 'Giáo viên cho phép xem đáp án — đáp án đúng được hiển thị bên dưới từng câu.'
              : 'Giáo viên chưa mở đáp án cho bài này.'}
          </div>

          {canRevealScore && scoreSummary.feedback && (
            <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 12, background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
              <MessageSquare size={18} color="var(--gray-500)" style={{ flex: 'none', marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 2 }}>NHẬN XÉT CỦA GIÁO VIÊN</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{scoreSummary.feedback}</div>
              </div>
            </div>
          )}
        </section>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {questions.length === 0 ? <EmptyState message="Bài tập này chưa có câu hỏi" /> : questions.map((question: any, index: number) => {
          const current = answers[Number(question.id)] || {};
          const result = results[Number(question.id)];
          const showResult = isLocked && canRevealAnswers && question.questionType !== 'essay' && result?.isCorrect !== undefined;
          const cardClass = showResult ? (result?.isCorrect ? 'hw-question-card is-graded-correct' : 'hw-question-card is-graded-wrong') : 'hw-question-card';

          return (
            <div key={question.id} className={cardClass}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{index + 1}</div>
                  <Badge variant="purple">{question.questionType}</Badge>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{question.score} điểm</span>
                </div>
                {showResult && (
                  <span className={`answer-result-pill ${result?.isCorrect ? 'correct' : 'incorrect'}`}>
                    {result?.isCorrect ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {result?.isCorrect ? 'Đúng' : 'Sai'}
                  </span>
                )}
                {isLocked && question.questionType === 'essay' && (
                  <span className={`answer-result-pill ${result?.score !== undefined ? 'correct' : 'pending'}`}>
                    {result?.score !== undefined
                      ? `Đã chấm: ${result.score} điểm`
                      : String(myStatus || '').toLowerCase() === 'graded'
                        ? 'Đã chấm — chờ công bố điểm'
                        : 'Chờ giáo viên chấm'}
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{question.questionText}</div>
              {question.helpText && <div style={{ color: 'var(--gray-600)', marginBottom: 14, whiteSpace: 'pre-wrap' }}>{question.helpText}</div>}

              {question.questionType === 'true_false' && (
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  {[
                    { value: 'true', label: 'Đúng' },
                    { value: 'false', label: 'Sai' },
                  ].map((option) => {
                    const isSelected = current.selectedAnswer === option.value;
                    const isCorrectChoice = canRevealAnswers && isLocked && String(question.correctAnswer || '').toLowerCase() === option.value;
                    const isWrongChoice = canRevealAnswers && isLocked && isSelected && !isCorrectChoice;
                    const cls = ['answer-option', isSelected && !canRevealAnswers ? 'is-selected' : '', isCorrectChoice ? 'is-correct-choice' : '', isWrongChoice ? 'is-wrong-choice' : ''].filter(Boolean).join(' ');
                    return (
                      <label key={option.value} className={cls} style={{ cursor: isLocked ? 'default' : 'pointer' }}>
                        <input type="radio" name={`q-${question.id}`} checked={isSelected} disabled={isLocked} onChange={() => setAnswer(question.id, { selectedAnswer: option.value })} />
                        <span style={{ fontWeight: 700 }}>{option.label}</span>
                        {isCorrectChoice && <CheckCircle2 size={16} color="var(--success)" />}
                        {isWrongChoice && <XCircle size={16} color="var(--danger)" />}
                      </label>
                    );
                  })}
                </div>
              )}

              {question.questionType === 'multiple_choice_4' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  {(question.options || []).map((option: any) => {
                    const isSelected = current.selectedAnswer === option.label;
                    const isCorrectChoice = canRevealAnswers && isLocked && question.correctAnswer === option.label;
                    const isWrongChoice = canRevealAnswers && isLocked && isSelected && !isCorrectChoice;
                    const cls = ['answer-option', isSelected && !canRevealAnswers ? 'is-selected' : '', isCorrectChoice ? 'is-correct-choice' : '', isWrongChoice ? 'is-wrong-choice' : ''].filter(Boolean).join(' ');
                    return (
                      <label key={option.label} className={cls} style={{ gridTemplateColumns: 'auto 1fr auto', cursor: isLocked ? 'default' : 'pointer' }}>
                        <input type="radio" name={`q-${question.id}`} checked={isSelected} disabled={isLocked} onChange={() => setAnswer(question.id, { selectedAnswer: option.label })} style={{ marginTop: 4 }} />
                        <span><b>{option.label}.</b> {option.text || <span style={{ color: 'var(--gray-400)' }}>Chưa nhập nội dung</span>}</span>
                        {isCorrectChoice && <CheckCircle2 size={16} color="var(--success)" />}
                        {isWrongChoice && <XCircle size={16} color="var(--danger)" />}
                      </label>
                    );
                  })}
                </div>
              )}

              {question.questionType === 'essay' && (
                <textarea className="form-textarea" rows={8} disabled={isLocked} value={current.answerText || ''} onChange={(e) => setAnswer(question.id, { answerText: e.target.value })} placeholder="Nhập bài làm của bạn" style={{ resize: 'vertical', minHeight: 180 }} />
              )}
            </div>
          );
        })}
      </div>

      {canEdit && questions.length > 0 && (
        <div style={{ position: 'sticky', bottom: 16, display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
          <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid var(--gray-200)', borderRadius: 999, padding: 10, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)' }}>
            <button className="btn btn-primary" onClick={() => submit()} disabled={saving} style={{ minWidth: 160 }}><Send size={14} /> {saving ? 'Đang nộp...' : `Nộp bài (${answeredCount}/${totalQuestions})`}</button>
          </div>
        </div>
      )}
    </div>
  );
}