import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, CalendarCheck, CheckCircle2, Eye, FileCheck2, History, Pencil, PlayCircle, Plus, RotateCcw, Save, Search, Send, Trash2, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { classesApi, examSetsApi, mockExamsApi } from '../../api';
import { Badge, ConfirmDialog, EmptyState, Loading, Modal, StatusBadge } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

const isManualQuestion = (q: any) => {
  const type = String(q.question_type || q.questionType || '').toLowerCase();
  return q.skill === 'Writing' || q.skill === 'Speaking' || type.startsWith('writing_') || type.startsWith('speaking_');
};

const getQuestionMaxScore = (q: any) => {
  if (q.format_code === 'VSTEP_4_SKILLS' && isManualQuestion(q)) return 10;
  const raw = Number(q.score || q.max_score || 0);
  if (raw > 1) return raw;
  return raw || 1;
};

const GRADING_STATUS_LABELS: Record<string, string> = {
  pending_ai: 'Chờ AI chấm',
  pending_manual: 'Chờ chấm tay',
  ai_processing: 'AI đang chấm',
  ai_graded: 'Chờ duyệt',
  ai_failed: 'AI chấm lỗi',
  reviewed: 'Đã duyệt',
  published: 'Đã công bố',
  not_required: 'Không cần chấm tay',
  queued: 'Đang xếp hàng',
  processing: 'AI đang chấm',
  failed: 'AI chấm lỗi',
};

const gradingStatusLabel = (status: string) => GRADING_STATUS_LABELS[status] || status || '-';

const DEFAULT_GRADING_CRITERIA: Record<string, any[]> = {
  Writing: [
    ['task_fulfillment', 'Task Fulfillment'], ['organization', 'Organization'], ['vocabulary', 'Vocabulary'], ['grammar', 'Grammar'], ['mechanics', 'Mechanics'],
  ].map(([code, label]) => ({ code, label, weight: 0.2, score: 0, feedback: '' })),
  Speaking: [
    ['grammar', 'Grammar'], ['vocabulary', 'Vocabulary'], ['pronunciation', 'Pronunciation / intelligibility'], ['fluency', 'Fluency'], ['content', 'Content'],
  ].map(([code, label]) => ({ code, label, weight: 0.2, score: 0, feedback: '' })),
};

function getAnswerFeedback(answer: any) {
  const metadata = answer?.metadata || {};
  return metadata.gradingFeedback || metadata.feedback || '';
}

function MockExamForm({ initial, onClose, onSuccess }: { initial?: any; onClose: () => void; onSuccess: () => void }) {
  const [examSets, setExamSets] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    title: initial?.title || '',
    examSetId: initial?.exam_set_id || '',
    classId: initial?.class_id || '',
    startTime: initial?.start_time ? initial.start_time.slice(0, 16) : '',
    endTime: initial?.end_time ? initial.end_time.slice(0, 16) : '',
    durationMinutes: initial?.duration_minutes || 0,
    attemptLimit: initial?.attempt_limit || 1,
    showResult: initial?.show_result ?? true,
    status: initial?.status || 'upcoming',
    note: initial?.note || '',
    reassign: false,
  });

  useEffect(() => {
    examSetsApi.getAll({ status: 'active', limit: 200 }).then(r => {
      const sets = r.data.examSets || [];
      setExamSets(sets);
      if (form.examSetId) {
        const selected = sets.find((s: any) => s.id === Number(form.examSetId));
        if (selected?.duration_minutes) {
          setForm((f: any) => ({ ...f, durationMinutes: Number(selected.duration_minutes) }));
        }
      }
    });
    classesApi.getAll({ limit: 200 }).then(r => setClasses(r.data.classes || []));
  }, []);

  const submit = async () => {
    if (!form.title || !form.examSetId) return toast.error('Vui lòng nhập tên kỳ thi và chọn bộ đề');
    // Validate thời gian bắt đầu và kết thúc
    if (form.startTime && form.endTime && new Date(form.startTime) >= new Date(form.endTime)) {
      return toast.error('Thời gian bắt đầu phải trước thời gian kết thúc');
    }
    const payload = { ...form, examSetId: Number(form.examSetId), classId: form.classId ? Number(form.classId) : null };
    try {
      if (initial) await mockExamsApi.update(initial.id, payload);
      else await mockExamsApi.create(payload);
      toast.success('Đã lưu kỳ thi thử');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  return (
    <Modal title={initial ? 'Sửa kỳ thi thử' : 'Tạo kỳ thi thử'} size="lg" onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={submit}>Lưu</button></>}>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Tên kỳ thi</label><input className="form-input" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="VD: Thi thử TOEIC tháng 6" /></div>
        <div className="form-group"><label className="form-label">Bộ đề <span className="required">*</span></label><select className="form-select" value={form.examSetId} onChange={e => {
          const selectedId = Number(e.target.value);
          const selectedSet = examSets.find(s => s.id === selectedId);
          setForm((f: any) => ({
            ...f,
            examSetId: e.target.value,
            durationMinutes: selectedSet?.duration_minutes ? Number(selectedSet.duration_minutes) : f.durationMinutes,
          }));
        }}><option value="">Chọn bộ đề</option>{examSets.map(e => <option key={e.id} value={e.id}>{e.title} - {e.exam_type} ({e.duration_minutes || 120} phút)</option>)}</select></div>
        <div className="form-group"><label className="form-label">Lớp tham gia</label><select className="form-select" value={form.classId || ''} onChange={e => setForm((f: any) => ({ ...f, classId: e.target.value }))}><option value="">Không gán lớp</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Bắt đầu</label><input type="datetime-local" className="form-input" value={form.startTime} onChange={e => setForm((f: any) => ({ ...f, startTime: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Kết thúc</label><input type="datetime-local" className="form-input" value={form.endTime} onChange={e => setForm((f: any) => ({ ...f, endTime: e.target.value }))} /></div>
        <div className="form-group">
          <label className="form-label">Thời lượng bài thi</label>
          <div className="form-input" style={{ background: '#f8fafc', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <span>⏱️</span>
            <span>{form.durationMinutes ? `${form.durationMinutes} phút` : 'Theo bộ đề'}</span>
            <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 400 }}>(tự động lấy từ bộ đề)</span>
          </div>
        </div>
        {/* #14: attemptLimit — 0 means unlimited */}
        <div className="form-group">
          <label className="form-label">Số lần thi tối đa <span style={{ color: 'var(--gray-500)', fontWeight: 400, fontSize: 12 }}>(0 = không giới hạn)</span></label>
          <input type="number" min={0} className="form-input" value={form.attemptLimit} onChange={e => setForm((f: any) => ({ ...f, attemptLimit: Number(e.target.value) }))} />
        </div>
        <div className="form-group"><label className="form-label">Trạng thái</label><select className="form-select" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}><option value="upcoming">Sắp diễn ra</option><option value="active">Đang mở</option><option value="closed">Đã đóng</option><option value="cancelled">Đã huỷ</option></select></div>
        {/* #14: showResult checkbox */}
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.showResult}
              onChange={e => setForm((f: any) => ({ ...f, showResult: e.target.checked }))} />
            Hiển thị kết quả cho học viên sau khi chấm xong
          </label>
          <span style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>Nếu bắt, học viên có thể xem điểm và nhận xét sau khi bài được chấm</span>
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Ghi chú</label><textarea className="form-textarea" value={form.note} onChange={e => setForm((f: any) => ({ ...f, note: e.target.value }))} /></div>
        {initial && <label style={{ display: 'flex', gap: 8, alignItems: 'center', gridColumn: '1/-1' }}><input type="checkbox" checked={form.reassign} onChange={e => setForm((f: any) => ({ ...f, reassign: e.target.checked }))} /> Gán lại danh sách học viên theo lớp (không xóa học viên đã bắt đầu làm bài)</label>}
      </div>
    </Modal>
  );
}

function StudentResultPanel({ detail, student }: { detail: any; student: any }) {
  const skillScores = student?.skill_score_breakdown || {};
  const showResult = detail?.show_result !== false && student?.status === 'graded' && (!!student?.published_at || student?.grading_status === 'not_required');
  const answersByQuestion = new Map<number, any>((student?.answers || []).map((a: any) => [Number(a.question_id), a]));
  const gradingsByQuestion = new Map<number, any>((student?.ai_gradings || []).map((a: any) => [Number(a.question_id), a]));
  const manualQuestions = (detail?.questions || []).filter(isManualQuestion);

  if (!student) return <EmptyState message="Không tìm thấy bài thi của bạn" />;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="grid-2">
        {/* #3: Only show objective_score when results are published */}
        <div className="stat-card"><div><div className="stat-value">{showResult ? (student.objective_score ?? 0) : '-'}</div><div className="stat-label">ĐIỂM TRẮC NGHIỆM</div></div><FileCheck2 color="var(--primary)" /></div>
        <div className="stat-card"><div><div className="stat-value">{showResult ? (student.total_score ?? '-') : '-'}</div><div className="stat-label">TỔNG ĐIỂM</div></div><CheckCircle2 color="var(--success)" /></div>
      </div>
      <div>Trạng thái: <StatusBadge status={student.status} /></div>
      {!showResult && <div className="alert alert-warning">Bài của bạn đã nộp nhưng chưa được giáo viên chấm xong, hoặc kỳ thi chưa bật hiển thị kết quả.</div>}
      {showResult && student.feedback && <div className="alert alert-success"><b>Nhận xét của giáo viên:</b><br />{student.feedback}</div>}
      {showResult && Object.keys(skillScores).length > 0 && (
        <div className="table-container">
          <table>
            <thead><tr><th>Kỹ năng</th><th>Điểm</th><th>Đúng/Tổng</th><th>Chi tiết</th></tr></thead>
            <tbody>{Object.entries(skillScores).map(([skill, val]: any) => (
              <tr key={skill}>
                <td>{skill}</td>
                <td>{val?.score10 ?? val?.score ?? '-'}</td>
                <td>{val?.correct !== undefined ? `${val.correct}/${val.total}` : '-'}</td>
                {/* #6: Show Writing Task1/Task2 breakdown for VSTEP */}
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  {skill === 'Writing' && val?.task1Score !== undefined
                    ? `Task 1: ${val.task1Score}/10 × 1/3 + Task 2: ${val.task2Score}/10 × 2/3`
                    : ''}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showResult && manualQuestions.length > 0 && (
        <div>
          <h4 style={{ marginBottom: 10 }}>Chi tiết Writing/Speaking</h4>
          <div style={{ display: 'grid', gap: 10 }}>
            {manualQuestions.map((q: any, idx: number) => {
              const ans: any = answersByQuestion.get(Number(q.id));
              return <div key={q.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><Badge variant="gray">Câu {idx + 1}</Badge><Badge variant="purple">{q.skill}</Badge><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{q.part}</span></div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{q.question_text}</div>
                {ans?.answer_text && <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}><b>Bài làm:</b><br />{ans.answer_text}</div>}
                {ans?.recording_url && <audio controls src={ans.recording_url} />}
                <div><b>Điểm:</b> {ans?.score ?? 0}</div>
                {getAnswerFeedback(ans) && <div style={{ marginTop: 6 }}><b>Nhận xét câu này:</b> {getAnswerFeedback(ans)}</div>}
                {((gradingsByQuestion.get(Number(q.id))?.criteria_scores || []) as any[]).length > 0 && (
                  <div className="table-container" style={{ marginTop: 10 }}>
                    <table><thead><tr><th>Tiêu chí</th><th>Điểm</th><th>Nhận xét</th></tr></thead><tbody>
                      {(gradingsByQuestion.get(Number(q.id))?.criteria_scores || []).map((criterion: any) => (
                        <tr key={criterion.code}><td>{criterion.label || criterion.code}</td><td>{criterion.score}/10</td><td>{criterion.feedback || '-'}</td></tr>
                      ))}
                    </tbody></table>
                  </div>
                )}
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GradingModal({ detail, student, onClose, onSuccess }: { detail: any; student: any; onClose: () => void; onSuccess: () => void }) {
  const questions = useMemo(() => (detail?.questions || []).filter(isManualQuestion), [detail]);
  const answersByQuestion = useMemo(() => new Map<number, any>((student?.answers || []).map((a: any) => [Number(a.question_id), a])), [student]);
  const aiGradingsByQuestion = useMemo(() => new Map<number, any>((student?.ai_gradings || []).map((a: any) => [Number(a.question_id), a])), [student]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const [criteria, setCriteria] = useState<Record<number, any[]>>({});
  const [generalFeedback, setGeneralFeedback] = useState(student?.feedback || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextScores: Record<number, number> = {};
    const nextFeedbacks: Record<number, string> = {};
    const nextCriteria: Record<number, any[]> = {};
    questions.forEach((q: any) => {
      const ans: any = answersByQuestion.get(Number(q.id));
      const ai: any = aiGradingsByQuestion.get(Number(q.id));
      const alreadyReviewed = ['reviewed', 'published'].includes(student?.grading_status);
      nextScores[q.id] = Number(alreadyReviewed ? (ans?.score || 0) : (ai?.score ?? ans?.score ?? 0));
      nextFeedbacks[q.id] = alreadyReviewed ? getAnswerFeedback(ans) : (ai?.feedback || getAnswerFeedback(ans));
      nextCriteria[q.id] = alreadyReviewed
        ? (ans?.metadata?.gradingCriteria || ai?.criteria_scores || [])
        : (ai?.criteria_scores || ans?.metadata?.gradingCriteria || DEFAULT_GRADING_CRITERIA[q.skill] || []);
    });
    setScores(nextScores);
    setFeedbacks(nextFeedbacks);
    setCriteria(nextCriteria);
    if (!student?.feedback && student?.ai_grading_run?.ai_result?.overallFeedback) {
      setGeneralFeedback(student.ai_grading_run.ai_result.overallFeedback);
    }
  }, [questions, answersByQuestion, aiGradingsByQuestion, student]);

  const computed = useMemo(() => {
    const bySkill: Record<string, number[]> = { Writing: [], Speaking: [] };
    questions.forEach((q: any) => {
      if (q.skill === 'Writing' || q.skill === 'Speaking') bySkill[q.skill].push(Number(scores[q.id] || 0));
    });
    const skillScores: Record<string, any> = {};
    const writingTask1 = questions.filter((q: any) => q.skill === 'Writing' && /task.?1/i.test(q.part || '')).map((q: any) => Number(scores[q.id] || 0));
    const writingTask2 = questions.filter((q: any) => q.skill === 'Writing' && /task.?2/i.test(q.part || '')).map((q: any) => Number(scores[q.id] || 0));
    if (writingTask1.length || writingTask2.length) {
      const task1Score = writingTask1.length ? writingTask1.reduce((a, b) => a + b, 0) / writingTask1.length : 0;
      const task2Score = writingTask2.length ? writingTask2.reduce((a, b) => a + b, 0) / writingTask2.length : 0;
      skillScores.Writing = {
        task1Score: Math.round(task1Score * 2) / 2,
        task2Score: Math.round(task2Score * 2) / 2,
        score10: Math.round((task1Score / 3 + task2Score * 2 / 3) * 2) / 2,
      };
    }
    if (bySkill.Speaking.length) {
      const avg = bySkill.Speaking.reduce((a, b) => a + b, 0) / bySkill.Speaking.length;
      skillScores.Speaking = { score10: Math.round(avg * 2) / 2 };
    }
    const manualScore = questions.reduce((sum: number, q: any) => sum + Number(scores[q.id] || 0), 0);
    return { skillScores, manualScore };
  }, [questions, scores]);

  const save = async () => {
    if (!student?.id) return toast.error('Không tìm thấy bài thi của học viên');
    // Cảnh báo khi chấm lại bài đã có điểm
    if (student?.status === 'graded') {
      const ok = window.confirm('Bài này đã được chấm trước đó. Bạn có chắc muốn chấm lại và ghi đè điểm cũ không?');
      if (!ok) return;
    }
    setSaving(true);
    try {
      const answerScores = questions.map((q: any) => ({
        questionId: q.id,
        answerId: answersByQuestion.get(Number(q.id))?.id,
        score: Number(scores[q.id] || 0),
        feedback: feedbacks[q.id] || '',
        criteria: criteria[q.id] || [],
      }));
      await mockExamsApi.grade(student.id, { answerScores, feedback: generalFeedback });
      toast.success('Đã duyệt điểm. Bạn có thể công bố kết quả cho học viên.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được điểm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Chấm bài - ${student?.full_name || ''}`} size="lg" onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Đóng</button><button className="btn btn-primary" onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu điểm'}</button></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="alert alert-info"><Bot size={16} /> Điểm AI là bản nháp. Teacher/Admin cần kiểm tra từng tiêu chí và bấm Lưu duyệt trước khi công bố.</div>
        <div className="grid-2">
          <div className="stat-card"><div><div className="stat-value">{student?.objective_score ?? 0}</div><div className="stat-label">ĐIỂM TRẮC NGHIỆM TỰ ĐỘNG</div></div><FileCheck2 color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{computed.manualScore}</div><div className="stat-label">ĐIỂM WRITING/SPEAKING</div></div><CheckCircle2 color="var(--success)" /></div>
        </div>

        {questions.length === 0 ? <EmptyState message="Bài thi này không có câu Writing/Speaking cần chấm thủ công" /> : questions.map((q: any, index: number) => {
          const ans: any = answersByQuestion.get(Number(q.id));
          const ai: any = aiGradingsByQuestion.get(Number(q.id));
          const maxScore = getQuestionMaxScore(q);
          return (
            <div key={q.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <Badge variant="gray">Câu {index + 1}</Badge>
                <Badge variant={q.skill === 'Writing' ? 'blue' : 'purple'}>{q.skill}</Badge>
                <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>{q.part} • {q.question_type}</span>
              </div>
              {q.group_content && <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8, color: 'var(--gray-700)' }}>{q.group_content}</div>}
              {q.image_url && <img src={q.image_url} alt="question" style={{ maxWidth: 320, borderRadius: 10, marginBottom: 10 }} />}
              {q.audio_url && <div style={{ marginBottom: 10 }}><audio controls src={q.audio_url} /></div>}
              <div style={{ fontWeight: 600, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{q.question_text}</div>
              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <b>Bài làm của học viên:</b>
                {ans?.answer_text ? <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{ans.answer_text}</div> : <div style={{ color: 'var(--gray-500)', marginTop: 6 }}>Chưa có câu trả lời dạng text.</div>}
                {ans?.recording_url && <div style={{ marginTop: 8 }}><audio controls src={ans.recording_url} /></div>}
                {ai?.transcript && <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}><b>Transcript AI:</b><br />{ai.transcript}</div>}
                {ai?.analysis_metadata?.transcriptConfidence != null && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gray-500)' }}>Độ tin cậy phiên âm: {Math.round(Number(ai.analysis_metadata.transcriptConfidence) * 100)}%</div>}
              </div>
              {(criteria[q.id] || []).length > 0 && (
                <div className="table-container" style={{ marginBottom: 12 }}>
                  <table>
                    <thead><tr><th>Tiêu chí</th><th style={{ width: 120 }}>Điểm /10</th><th>Nhận xét AI</th></tr></thead>
                    <tbody>{(criteria[q.id] || []).map((criterion: any, criterionIndex: number) => (
                      <tr key={criterion.code || criterionIndex}>
                        <td>{criterion.label || criterion.code}</td>
                        <td><input type="number" min={0} max={10} step="0.5" className="form-input" value={criterion.score ?? 0} onChange={e => {
                          const next = [...(criteria[q.id] || [])];
                          next[criterionIndex] = { ...next[criterionIndex], score: Number(e.target.value) };
                          setCriteria(prev => ({ ...prev, [q.id]: next }));
                          const weighted = next.reduce((sum: number, item: any) => sum + Number(item.score || 0) * Number(item.weight || (1 / next.length)), 0);
                          setScores(prev => ({ ...prev, [q.id]: Math.round(weighted * 2) / 2 }));
                        }} /></td>
                        <td><textarea className="form-textarea" rows={2} value={criterion.feedback || ''} onChange={e => {
                          const next = [...(criteria[q.id] || [])];
                          next[criterionIndex] = { ...next[criterionIndex], feedback: e.target.value };
                          setCriteria(prev => ({ ...prev, [q.id]: next }));
                        }} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Điểm câu này {maxScore ? `(0 - ${maxScore})` : ''}</label>
                  <input type="number" min={0} max={maxScore || undefined} step="0.5" className="form-input" value={scores[q.id] ?? 0} onChange={e => setScores(prev => ({ ...prev, [q.id]: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nhận xét câu này</label>
                  <textarea className="form-textarea" rows={2} value={feedbacks[q.id] || ''} onChange={e => setFeedbacks(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="VD: Bố cục ổn, cần cải thiện ngữ pháp/phát âm..." />
                </div>
              </div>
            </div>
          );
        })}

        <div className="form-group">
          <label className="form-label">Nhận xét tổng bài</label>
          <textarea className="form-textarea" rows={3} value={generalFeedback} onChange={e => setGeneralFeedback(e.target.value)} placeholder="Nhận xét chung hiển thị cho học viên sau khi chấm xong" />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* #6: Show VSTEP Writing Task1/Task2 breakdown in grading summary */}
          {computed.skillScores.Writing?.task1Score !== undefined ? (
            <>
              <Badge variant="blue">Writing Task 1: {computed.skillScores.Writing.task1Score}/10</Badge>
              <Badge variant="blue">Writing Task 2: {computed.skillScores.Writing.task2Score}/10</Badge>
              <Badge variant="orange">Writing Tổng (Task 1 × 1/3 + Task 2 × 2/3): {computed.skillScores.Writing.score10}/10</Badge>
            </>
          ) : (
            <Badge variant="blue">Writing: {computed.skillScores.Writing?.score10 ?? '-'}</Badge>
          )}
          <Badge variant="purple">Speaking: {computed.skillScores.Speaking?.score10 ?? '-'}</Badge>
          <Badge variant="green">Manual total: {computed.manualScore}</Badge>
        </div>
      </div>
    </Modal>
  );
}

export default function MockExamsPage() {
  const { user, tenantSlug } = useAuth();
  const roles = user?.roles || [];
  const canManage = roles.includes('admin') || roles.includes('staff');
  const canDelete = roles.includes('admin');
  const canGrade = roles.includes('admin') || roles.includes('teacher');
  const isStudent = roles.includes('student') && !canManage;
  const isTeacher = roles.includes('teacher') && !canManage;

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [gradingStudent, setGradingStudent] = useState<any>(null);
  const [runningAiFor, setRunningAiFor] = useState<number | null>(null);
  const [publishingFor, setPublishingFor] = useState<number | null>(null);
  const [gradingHistory, setGradingHistory] = useState<{ student: any; runs: any[] } | null>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mockExamsApi.getAll({ search, status });
      setRows(res.data.mockExams || []);
      setTotal(res.data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  const edit = async (row: any) => {
    const res = await mockExamsApi.getById(row.id);
    setEditing(res.data);
  };

  const view = async (row: any) => {
    const res = await mockExamsApi.getById(row.id);
    setDetail(res.data);
  };

  const refreshDetail = async () => {
    if (!detail?.id) return;
    const res = await mockExamsApi.getById(detail.id);
    setDetail(res.data);
    await load();
  };

  const del = async () => {
    if (!deleting?.id) return;
    try {
      await mockExamsApi.delete(deleting.id);
      toast.success('Đã xoá kỳ thi');
      setDeleting(null);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xoá kỳ thi');
    }
  };

  const runAiGrading = async (student: any) => {
    if (!student?.id) return;
    if (!window.confirm('Chạy AI chấm Writing và Speaking cho bài này? Kết quả mới sẽ được lưu thành một lần chấm riêng.')) return;
    setRunningAiFor(student.id);
    try {
      await mockExamsApi.runAiGrading(student.id);
      toast.success('AI đã chấm xong. Vui lòng mở Duyệt điểm để kiểm tra.');
      await refreshDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'AI chưa thể chấm bài');
      await refreshDetail();
    } finally {
      setRunningAiFor(null);
    }
  };

  const publishGrade = async (student: any) => {
    if (!student?.id) return;
    if (!window.confirm(`Công bố điểm của ${student.full_name}? Sau khi công bố, học viên sẽ xem được kết quả.`)) return;
    setPublishingFor(student.id);
    try {
      await mockExamsApi.publishGrade(student.id);
      toast.success('Đã công bố điểm cho học viên');
      await refreshDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không công bố được điểm');
    } finally {
      setPublishingFor(null);
    }
  };

  const viewGradingHistory = async (student: any) => {
    try {
      const res = await mockExamsApi.getGradingHistory(student.id);
      setGradingHistory({ student, runs: res.data.runs || [] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không tải được lịch sử chấm');
    }
  };

  const statLabel = isStudent ? 'BÀI THI CỦA TÔI' : 'KỲ THI';
  const subtitle = isStudent
    ? 'Theo dõi kỳ thi được giao, trạng thái làm bài và điểm số của bạn'
    : isTeacher
      ? 'Xem bài nộp và chấm Writing/Speaking cho các lớp được phân công'
      : 'Lên lịch thi thử, gán lớp, theo dõi bài nộp và điểm số';

  const detailRows = useMemo(() => detail?.students || [], [detail]);
  const currentStudent = isStudent ? detailRows[0] : null;

  const openExamTab = (path: string) => {
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Kỳ thi thử</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Tạo kỳ thi</button>}
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><div className="stat-value">{total}</div><div className="stat-label">{statLabel}</div></div><CalendarCheck color="var(--primary)" /></div>
      </div>

      <div className="filter-bar">
        <div className="search-input"><Search className="search-icon" size={14} /><input className="form-input" placeholder="Tìm kỳ thi..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="form-select" style={{ width: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="upcoming">Sắp diễn ra</option>
          <option value="active">Đang mở</option>
          <option value="closed">Đã đóng</option>
          <option value="cancelled">Đã huỷ</option>
        </select>
      </div>

      {loading ? <Loading /> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Kỳ thi</th>
                <th>Bộ đề</th>
                <th>Lớp</th>
                {!isStudent && <th>Học viên</th>}
                {!isStudent && <th>Nộp bài</th>}
                {!isStudent && <th>Điểm TB</th>}
                {isStudent && <th>Bài làm</th>}
                {isStudent && <th>Điểm</th>}
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={isStudent ? 7 : 8}><EmptyState /></td></tr> : rows.map(r => {
                const attemptStatus = r.my_status || 'assigned';
                const studentScore = attemptStatus === 'graded' ? (r.my_total_score ?? '-') : '-';
                return (
                  <tr key={r.id}>
                    <td><b>{r.title}</b><div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{r.start_time ? new Date(r.start_time).toLocaleString('vi-VN') : 'Chưa lên lịch'}</div></td>
                    <td><Badge variant={r.exam_type === 'TOEIC' ? 'blue' : 'purple'}>{r.exam_set_title}</Badge></td>
                    <td>{r.class_name || '-'}</td>
                    {!isStudent && <td>{r.student_count}</td>}
                    {!isStudent && <td>{r.submitted_count}</td>}
                    {!isStudent && <td>{r.avg_score || '-'}</td>}
                    {isStudent && <td><StatusBadge status={attemptStatus} /></td>}
                    {isStudent && <td>{studentScore}</td>}
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canManage || isTeacher ? <button className="btn btn-secondary btn-sm" onClick={() => view(r)}><UsersRound size={12} /> Danh sách</button> : null}
                        {canManage && <button className="btn btn-secondary btn-sm" onClick={() => edit(r)}><Pencil size={12} /> Sửa</button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 size={12} /> Xoá</button>}
                        {isStudent && <button className="btn btn-secondary btn-sm" onClick={() => view(r)}><Eye size={12} /> Chi tiết</button>}
                        {/* #5: Practice mode removed — uses the same exam questions as the official exam,
                            which would expose answer keys before students sit the real exam.
                            Re-enable only when a separate practice question bank is implemented. */}
                        {isStudent && r.status === 'active' && !['submitted', 'graded'].includes(attemptStatus) && (
                          <button className="btn btn-primary btn-sm" onClick={() => openExamTab(`/${tenantSlug}/student/mock-exams/${r.id}/take`)}><PlayCircle size={12} /> Vào thi thử</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && canManage && <MockExamForm onClose={() => setShowAdd(false)} onSuccess={load} />}
      {editing && canManage && <MockExamForm initial={editing} onClose={() => setEditing(null)} onSuccess={load} />}
      {detail && (
        <Modal title={isStudent ? `Chi tiết kỳ thi - ${detail.title}` : `Danh sách học viên - ${detail.title}`} size={isTeacher ? 'xl' : 'lg'} onClose={() => setDetail(null)}>
          {isStudent ? <StudentResultPanel detail={detail} student={currentStudent} /> : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Học viên</th>
                    <th>Email</th>
                    <th>Trạng thái</th>
                    <th>Attempt</th>
                    <th>Điểm trắc nghiệm</th>
                    <th>Điểm thủ công</th>
                    <th>Điểm tổng</th>
                    <th>Chấm AI</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.length ? detailRows.map((s: any) => {
                    const canGradeStudent = canGrade && ['submitted', 'graded'].includes(s.status) && s.latest_attempt_id;
                    const gradingStatus = s.latest_attempt_id ? (s.grading_status || 'pending_ai') : '';
                    return (
                      <tr key={s.id}>
                        <td>{s.full_name}</td>
                        <td>{s.email}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td>{s.latest_attempt_no || '-'}</td>
                        <td>{s.objective_score ?? '-'}</td>
                        <td>{s.manual_score ?? '-'}</td>
                        <td>{s.total_score ?? '-'}</td>
                        <td>{gradingStatus ? <Badge variant={gradingStatus === 'published' ? 'green' : gradingStatus === 'ai_failed' ? 'red' : gradingStatus === 'reviewed' ? 'blue' : 'orange'}>{gradingStatusLabel(gradingStatus)}</Badge> : '-'}</td>
                        <td>{canGradeStudent ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {detail?.format_code === 'VSTEP_4_SKILLS' && ['pending_ai', 'ai_failed', 'reviewed', 'published'].includes(gradingStatus) && (
                            <button className="btn btn-secondary btn-sm" disabled={runningAiFor === s.id} onClick={() => runAiGrading(s)}>
                              {gradingStatus === 'ai_failed' ? <RotateCcw size={12} /> : <Bot size={12} />} {runningAiFor === s.id ? 'AI đang chấm...' : gradingStatus === 'ai_failed' ? 'Thử lại AI' : 'Chấm AI'}
                            </button>
                          )}
                          {['ai_graded', 'reviewed', 'published'].includes(gradingStatus) && (
                            <button className="btn btn-primary btn-sm" onClick={() => setGradingStudent(s)}><FileCheck2 size={12} /> {gradingStatus === 'ai_graded' ? 'Duyệt điểm' : 'Xem/sửa'}</button>
                          )}
                          {['pending_manual', 'ai_failed'].includes(gradingStatus) && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setGradingStudent(s)}><FileCheck2 size={12} /> Chấm thủ công</button>
                          )}
                          {gradingStatus === 'reviewed' && (
                            <button className="btn btn-primary btn-sm" disabled={publishingFor === s.id} onClick={() => publishGrade(s)}><Send size={12} /> {publishingFor === s.id ? 'Đang công bố...' : 'Công bố'}</button>
                          )}
                          {s.ai_grading_run && <button className="btn btn-secondary btn-sm" onClick={() => viewGradingHistory(s)}><History size={12} /> Lịch sử</button>}
                        </div> : <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>{s.latest_attempt_id ? 'Chỉ xem' : 'Chưa nộp'}</span>}</td>
                      </tr>
                    );
                  }) : <tr><td colSpan={9}><EmptyState /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
      {gradingStudent && detail && <GradingModal detail={detail} student={gradingStudent} onClose={() => setGradingStudent(null)} onSuccess={refreshDetail} />}
      {gradingHistory && <Modal title={`Lịch sử chấm - ${gradingHistory.student?.full_name || ''}`} size="lg" onClose={() => setGradingHistory(null)}>
        <div className="table-container"><table><thead><tr><th>Lần</th><th>Nguồn</th><th>Trạng thái</th><th>Model</th><th>Người duyệt</th><th>Thời gian / lỗi</th></tr></thead><tbody>
          {gradingHistory.runs.length ? gradingHistory.runs.map((run: any, index: number) => <tr key={run.id}>
            <td>#{gradingHistory.runs.length - index}</td>
            <td>{run.trigger_type === 'automatic' ? 'Tự động' : run.trigger_type === 'retry' ? 'Chấm lại AI' : 'Chấm tay'}</td>
            <td><Badge variant={run.status === 'published' ? 'green' : run.status === 'failed' ? 'red' : 'blue'}>{gradingStatusLabel(run.status)}</Badge></td>
            <td>{run.grading_model || '-'}</td>
            <td>{run.reviewed_by_name || '-'}</td>
            <td>
              <div>{run.created_at ? new Date(run.created_at).toLocaleString('vi-VN') : '-'}</div>
              {run.error_message && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4, maxWidth: 360, whiteSpace: 'normal' }}>{run.error_message}</div>}
            </td>
          </tr>) : <tr><td colSpan={6}><EmptyState message="Chưa có lịch sử chấm" /></td></tr>}
        </tbody></table></div>
      </Modal>}
      {deleting && <ConfirmDialog message={deleting.status === 'cancelled' ? `Kỳ thi "${deleting.title}" đã được huỷ. Bạn có chắc chắn muốn xoá vĩnh viễn kỳ thi này và toàn bộ dữ liệu làm bài liên quan?` : `Xoá kỳ thi "${deleting.title}"?`} onCancel={() => setDeleting(null)} onConfirm={del} />}
    </div>
  );
}
