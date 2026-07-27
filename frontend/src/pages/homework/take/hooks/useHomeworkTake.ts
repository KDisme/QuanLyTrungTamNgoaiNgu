import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { homeworkApi } from '../../../../api';

export type AnswerState = Record<number, { answerText?: string; selectedAnswer?: string }>;
export type ResultState = Record<number, { isCorrect?: boolean; score?: number }>;

export function useHomeworkTake() {
  const { id } = useParams();
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

  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState<string | null>(null);

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

  const saveDraft = async (silent = false) => {
    if (!canEdit) return;
    const payloadAnswers = questions.map((question: any) => {
      const answer = answers[Number(question.id)] || {};
      if (question.questionType === 'essay') {
        return { questionId: question.id, answerText: answer.answerText || '' };
      }
      return { questionId: question.id, selectedAnswer: answer.selectedAnswer || '' };
    });

    if (!silent) setDraftStatus('saving');
    try {
      await homeworkApi.submit(assignmentId, {
        answers: payloadAnswers,
        password: verifiedPassword,
        isDraft: true,
      });
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastDraftSavedTime(timeStr);
      if (!silent) {
        setDraftStatus('saved');
        toast.success('Đã lưu bản nháp thành công');
      }
    } catch (err) {
      if (!silent) {
        setDraftStatus('error');
        toast.error('Không thể lưu bản nháp');
      }
    }
  };

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!canEdit || loading || !detail) return;
    const timer = setInterval(() => {
      const payloadAnswers = questions.map((question: any) => {
        const answer = answersRef.current[Number(question.id)] || {};
        if (question.questionType === 'essay') {
          return { questionId: question.id, answerText: answer.answerText || '' };
        }
        return { questionId: question.id, selectedAnswer: answer.selectedAnswer || '' };
      });
      homeworkApi.submit(assignmentId, {
        answers: payloadAnswers,
        password: verifiedPassword,
        isDraft: true,
      }).then(() => {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setLastDraftSavedTime(timeStr);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [canEdit, loading, detail, verifiedPassword, questions]);

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

  const totalQuestions = questions.length;
  const answeredCount = questions.filter((question: any) => {
    const current = answers[Number(question.id)] || {};
    if (question.questionType === 'essay') return !!String(current.answerText || '').trim();
    return !!String(current.selectedAnswer || '').trim();
  }).length;
  const completionRate = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return {
    detail,
    loading,
    saving,
    answers,
    results,
    needsPassword,
    passwordError,
    passwordInput,
    setPasswordInput,
    setPasswordError,
    verifying,
    timeUp,
    secondsLeft,
    draftStatus,
    lastDraftSavedTime,
    unlock,
    saveDraft,
    setAnswer,
    submit,
    questions,
    myStatus,
    canEdit,
    isLocked,
    canRevealAnswers,
    canRevealScore,
    scoreSummary,
    totalQuestions,
    answeredCount,
    completionRate,
  };
}