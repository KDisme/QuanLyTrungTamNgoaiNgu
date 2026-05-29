import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Clock, Mic, RotateCcw, Send, Square } from 'lucide-react';
import { mockExamsApi } from '../../api';
import { Badge, EmptyState, Loading, StatusBadge } from '../../components/common';

type RecordingState = {
  status: 'idle' | 'recording' | 'ready' | 'uploading';
  blob?: Blob;
  url?: string;
  durationSeconds?: number;
  error?: string;
};

const isSpeakingQuestion = (q: any) => {
  const type = String(q.question_type || '').toLowerCase();
  return q.skill === 'Speaking' || type.startsWith('speaking_') || type.includes('speaking');
};

const isWritingQuestion = (q: any) => {
  const type = String(q.question_type || '').toLowerCase();
  return q.skill === 'Writing' || type.startsWith('writing_') || type.includes('essay') || type.includes('email');
};

const formatSeconds = (value?: number) => {
  const total = Math.max(0, Math.floor(value || 0));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function StudentMockExamTakePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [recordings, setRecordings] = useState<Record<number, RecordingState>>({});

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingQuestionRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingsRef = useRef<Record<number, RecordingState>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await mockExamsApi.getById(Number(id));
        if (mounted) setExam(res.data);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Không tải được kỳ thi');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
      Object.values(recordingsRef.current).forEach(item => { if (item.url) URL.revokeObjectURL(item.url); });
    };
  }, []);

  const questions = useMemo(() => exam?.questions || [], [exam]);
  const studentRow = useMemo(() => exam?.students?.[0], [exam]);
  const canSubmit = exam?.status === 'active' && studentRow && !['graded'].includes(studentRow.status);

  const setSelectedOption = (questionId: number, selectedOptionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), questionId, selectedOptionId } }));
  };

  const setTextAnswer = (questionId: number, answerText: string) => {
    const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
    setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), questionId, answerText, wordCount, charCount: answerText.length } }));
  };

  const stopCurrentStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const startRecording = async (questionId: number) => {
    if (!canSubmit || submitting) return;
    if (recordingQuestionRef.current && recordingQuestionRef.current !== questionId) {
      toast.error('Bạn đang ghi âm câu khác. Hãy dừng ghi âm trước.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome/Edge và cho phép microphone.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      recordingQuestionRef.current = questionId;
      recordingStartedAtRef.current = Date.now();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const oldUrl = recordingsRef.current[questionId]?.url;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        const url = URL.createObjectURL(blob);
        setRecordings(prev => ({ ...prev, [questionId]: { status: 'ready', blob, url, durationSeconds } }));
        setAnswers(prev => ({
          ...prev,
          [questionId]: {
            ...(prev[questionId] || {}),
            questionId,
            durationSeconds,
            metadata: { ...(prev[questionId]?.metadata || {}), answerType: 'audio', mimeType: blob.type },
          },
        }));
        recordingQuestionRef.current = null;
        recorderRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        stopCurrentStream();
      };

      recorder.start();
      setRecordings(prev => ({ ...prev, [questionId]: { status: 'recording', durationSeconds: 0 } }));
      timerRef.current = setInterval(() => {
        const seconds = Math.max(0, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        setRecordings(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || { status: 'recording' }), status: 'recording', durationSeconds: seconds } }));
      }, 500);
    } catch (err: any) {
      stopCurrentStream();
      recordingQuestionRef.current = null;
      toast.error('Không thể mở microphone. Vui lòng cấp quyền ghi âm cho trình duyệt.');
      setRecordings(prev => ({ ...prev, [questionId]: { status: 'idle', error: err?.message || 'Microphone error' } }));
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const resetRecording = (questionId: number) => {
    const oldUrl = recordings[questionId]?.url;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    setRecordings(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setAnswers(prev => {
      const next = { ...prev };
      if (next[questionId]) {
        delete next[questionId].recordingUrl;
        delete next[questionId].durationSeconds;
        next[questionId].metadata = { ...(next[questionId].metadata || {}), answerType: 'audio' };
      }
      return next;
    });
  };

  const buildPayload = async () => {
    if (!studentRow?.id) throw new Error('Không tìm thấy phiếu thi của bạn');
    const payload: any[] = [];
    const speakingQuestions = questions.filter(isSpeakingQuestion);

    for (const q of speakingQuestions) {
      const rec = recordings[q.id];
      if (!rec?.blob) continue;
      setRecordings(prev => ({ ...prev, [q.id]: { ...prev[q.id], status: 'uploading' } }));
      const res = await mockExamsApi.uploadRecording(studentRow.id, rec.blob);
      payload.push({
        questionId: q.id,
        recordingUrl: res.data.url,
        durationSeconds: rec.durationSeconds || answers[q.id]?.durationSeconds || 0,
        metadata: {
          ...(answers[q.id]?.metadata || {}),
          answerType: 'audio',
          mimeType: rec.blob.type,
          originalName: res.data.originalName,
        },
      });
      setRecordings(prev => ({ ...prev, [q.id]: { ...prev[q.id], status: 'ready' } }));
    }

    Object.values(answers).forEach((a: any) => {
      if (!a?.questionId) return;
      const question = questions.find((q: any) => q.id === a.questionId);
      if (question && isSpeakingQuestion(question)) return;
      payload.push(a);
    });

    return payload;
  };

  const submit = async () => {
    if (!studentRow?.id) return toast.error('Không tìm thấy phiếu thi của bạn');
    if (!canSubmit) return toast.error('Kỳ thi chưa mở hoặc bạn không thể nộp bài');
    if (recordingQuestionRef.current) return toast.error('Bạn đang ghi âm. Hãy dừng ghi âm trước khi nộp bài.');

    const speakingQuestions = questions.filter(isSpeakingQuestion);
    const missingSpeaking = speakingQuestions.filter((q: any) => !recordings[q.id]?.blob);
    if (missingSpeaking.length) {
      const okMissing = window.confirm(`Bạn còn ${missingSpeaking.length} câu Speaking chưa ghi âm. Bạn vẫn muốn nộp bài?`);
      if (!okMissing) return;
    }

    const ok = window.confirm('Bạn chắc chắn muốn nộp bài? Sau khi nộp, hệ thống sẽ ghi nhận lần làm bài này.');
    if (!ok) return;
    setSubmitting(true);
    try {
      const payload = await buildPayload();
      if (!payload.length) {
        toast.error('Bạn chưa chọn/nhập/ghi âm câu trả lời nào');
        return;
      }
      await mockExamsApi.submit(studentRow.id, payload);
      toast.success('Đã nộp bài');
      navigate(-1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Không nộp được bài');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (!exam) return <EmptyState message="Không tìm thấy kỳ thi" />;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}><ArrowLeft size={12} /> Quay lại</button>
          <h1 className="page-title">{exam.title}</h1>
          <p className="page-subtitle">{exam.exam_set_title} • {exam.duration_minutes} phút • {exam.start_time ? new Date(exam.start_time).toLocaleString('vi-VN') : 'Chưa lên lịch'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={exam.status} />
          <Badge variant="blue"><Clock size={12} /> {exam.duration_minutes} phút</Badge>
        </div>
      </div>

      {exam.status !== 'active' && <div className="alert alert-warning" style={{ marginBottom: 16 }}>Kỳ thi chưa ở trạng thái đang mở, bạn chỉ có thể xem thông tin.</div>}
      {studentRow?.status && <div style={{ marginBottom: 16 }}>Trạng thái bài làm: <StatusBadge status={studentRow.status} /></div>}

      <div className="table-container" style={{ padding: 16 }}>
        {questions.length === 0 ? <EmptyState message="Bộ đề chưa có câu hỏi" /> : questions.map((q: any, index: number) => {
          const options = q.options || [];
          const speaking = isSpeakingQuestion(q);
          const writing = isWritingQuestion(q);
          const rec = recordings[q.id] || { status: 'idle' as const };
          return (
            <div key={q.id} style={{ borderBottom: '1px solid var(--gray-200)', padding: '16px 0' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <Badge variant="gray">Câu {index + 1}</Badge>
                <Badge variant={q.skill === 'Listening' ? 'blue' : q.skill === 'Reading' ? 'green' : q.skill === 'Speaking' ? 'purple' : 'orange'}>{q.skill}</Badge>
                <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>{q.part}</span>
                {speaking && q.prep_seconds ? <Badge variant="gray">Chuẩn bị {q.prep_seconds}s</Badge> : null}
                {speaking && q.response_seconds ? <Badge variant="blue">Trả lời {q.response_seconds}s</Badge> : null}
              </div>
              {q.group_content && <div style={{ whiteSpace: 'pre-wrap', marginBottom: 10, color: 'var(--gray-700)' }}>{q.group_content}</div>}
              {q.image_url && <img src={q.image_url} alt="question" style={{ maxWidth: 360, borderRadius: 10, marginBottom: 10 }} />}
              {q.audio_url && <div style={{ marginBottom: 10 }}><audio controls src={q.audio_url} /></div>}
              <div style={{ fontWeight: 600, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{q.question_text || q.topic || 'Chọn đáp án đúng'}</div>

              {speaking ? (
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 12, background: 'var(--gray-50)' }}>
                  <div style={{ marginBottom: 8, color: 'var(--gray-600)', fontSize: 13 }}>
                    Phần Speaking yêu cầu ghi âm trực tiếp. Hãy cấp quyền microphone cho trình duyệt, bấm “Bắt đầu ghi âm”, trả lời, rồi bấm “Dừng”.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge variant={rec.status === 'recording' ? 'red' : rec.status === 'ready' ? 'green' : 'gray'}>
                      {rec.status === 'recording' ? `Đang ghi âm ${formatSeconds(rec.durationSeconds)}` : rec.status === 'uploading' ? 'Đang upload...' : rec.status === 'ready' ? `Đã ghi âm ${formatSeconds(rec.durationSeconds)}` : 'Chưa ghi âm'}
                    </Badge>
                    {rec.status !== 'recording' ? (
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => startRecording(q.id)} disabled={!canSubmit || submitting || rec.status === 'uploading'}>
                        <Mic size={13} /> {rec.status === 'ready' ? 'Ghi lại' : 'Bắt đầu ghi âm'}
                      </button>
                    ) : (
                      <button className="btn btn-danger btn-sm" type="button" onClick={stopRecording}>
                        <Square size={13} /> Dừng ghi âm
                      </button>
                    )}
                    {rec.status === 'ready' && (
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => resetRecording(q.id)} disabled={!canSubmit || submitting}>
                        <RotateCcw size={13} /> Xoá bản ghi
                      </button>
                    )}
                  </div>
                  {rec.url && <div style={{ marginTop: 10 }}><audio controls src={rec.url} /></div>}
                  {rec.error && <div style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>{rec.error}</div>}
                </div>
              ) : writing ? (
                <textarea className="form-textarea" rows={6} placeholder="Nhập bài viết của bạn..." value={answers[q.id]?.answerText || ''} onChange={e => setTextAnswer(q.id, e.target.value)} disabled={!canSubmit || submitting} />
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {options.map((opt: any) => (
                    <label key={opt.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, border: '1px solid var(--gray-200)', borderRadius: 10 }}>
                      <input type="radio" name={`q-${q.id}`} checked={answers[q.id]?.selectedOptionId === opt.id} onChange={() => setSelectedOption(q.id, opt.id)} disabled={!canSubmit || submitting} />
                      <span><b>{opt.optionLabel || opt.option_label}.</b> {opt.optionText || opt.option_text}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Huỷ</button>
        <button className="btn btn-primary" onClick={submit} disabled={!canSubmit || submitting}><Send size={14} /> {submitting ? 'Đang nộp...' : 'Nộp bài'}</button>
      </div>

      {studentRow?.status === 'submitted' && <div style={{ marginTop: 12, color: 'var(--success)' }}><CheckCircle2 size={14} /> Bạn đã có bài nộp. Nếu kỳ thi cho phép nhiều lần, hệ thống sẽ ghi nhận lần nộp tiếp theo cho đến giới hạn.</div>}
    </div>
  );
}
