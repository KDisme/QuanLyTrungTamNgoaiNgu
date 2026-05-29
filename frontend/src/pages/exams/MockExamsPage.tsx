import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Eye, FileCheck2, Pencil, PlayCircle, Plus, Save, Search, Trash2, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { classesApi, examSetsApi, mockExamsApi } from '../../api';
import { Badge, ConfirmDialog, EmptyState, Loading, Modal, StatusBadge } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

const isManualQuestion = (q: any) => {
  const type = String(q.question_type || q.questionType || '').toLowerCase();
  return q.skill === 'Writing' || q.skill === 'Speaking' || type.startsWith('writing_') || type.startsWith('speaking_');
};

const getQuestionMaxScore = (q: any) => {
  const raw = Number(q.score || q.max_score || 0);
  if (raw > 1) return raw;
  const type = String(q.question_type || '').toLowerCase();
  if (type === 'speaking_opinion' || type === 'writing_essay') return 5;
  if (type === 'writing_email_response') return 4;
  if (q.skill === 'Writing' || q.skill === 'Speaking') return 10;
  return raw || 1;
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
    durationMinutes: initial?.duration_minutes || 120,
    attemptLimit: initial?.attempt_limit || 1,
    showResult: initial?.show_result ?? true,
    status: initial?.status || 'upcoming',
    note: initial?.note || '',
    reassign: false,
  });

  useEffect(() => {
    examSetsApi.getAll({ status: 'active', limit: 200 }).then(r => setExamSets(r.data.examSets || []));
    classesApi.getAll({ limit: 200 }).then(r => setClasses(r.data.classes || []));
  }, []);

  const submit = async () => {
    if (!form.title || !form.examSetId) return toast.error('Vui lòng nhập tên kỳ thi và chọn bộ đề');
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
        <div className="form-group"><label className="form-label">Bộ đề</label><select className="form-select" value={form.examSetId} onChange={e => setForm((f: any) => ({ ...f, examSetId: e.target.value }))}><option value="">Chọn bộ đề</option>{examSets.map(e => <option key={e.id} value={e.id}>{e.title} - {e.exam_type}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Lớp tham gia</label><select className="form-select" value={form.classId || ''} onChange={e => setForm((f: any) => ({ ...f, classId: e.target.value }))}><option value="">Không gán lớp</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Bắt đầu</label><input type="datetime-local" className="form-input" value={form.startTime} onChange={e => setForm((f: any) => ({ ...f, startTime: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Kết thúc</label><input type="datetime-local" className="form-input" value={form.endTime} onChange={e => setForm((f: any) => ({ ...f, endTime: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Thời gian phút</label><input type="number" className="form-input" value={form.durationMinutes} onChange={e => setForm((f: any) => ({ ...f, durationMinutes: Number(e.target.value) }))} /></div>
        <div className="form-group"><label className="form-label">Trạng thái</label><select className="form-select" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}><option value="upcoming">Sắp diễn ra</option><option value="active">Đang mở</option><option value="closed">Đã đóng</option><option value="cancelled">Đã huỷ</option></select></div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Ghi chú</label><textarea className="form-textarea" value={form.note} onChange={e => setForm((f: any) => ({ ...f, note: e.target.value }))} /></div>
        {initial && <label style={{ display: 'flex', gap: 8, alignItems: 'center', gridColumn: '1/-1' }}><input type="checkbox" checked={form.reassign} onChange={e => setForm((f: any) => ({ ...f, reassign: e.target.checked }))} /> Gán lại danh sách học viên theo lớp</label>}
      </div>
    </Modal>
  );
}

function StudentResultPanel({ detail, student }: { detail: any; student: any }) {
  const skillScores = student?.skill_score_breakdown || {};
  const showResult = detail?.show_result !== false && student?.status === 'graded';
  const answersByQuestion = new Map<number, any>((student?.answers || []).map((a: any) => [Number(a.question_id), a]));
  const manualQuestions = (detail?.questions || []).filter(isManualQuestion);

  if (!student) return <EmptyState message="Không tìm thấy bài thi của bạn" />;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="grid-2">
        <div className="stat-card"><div><div className="stat-value">{student.objective_score ?? 0}</div><div className="stat-label">ĐIỂM TRẮC NGHIỆM</div></div><FileCheck2 color="var(--primary)" /></div>
        <div className="stat-card"><div><div className="stat-value">{showResult ? (student.total_score ?? '-') : '-'}</div><div className="stat-label">TỔNG ĐIỂM</div></div><CheckCircle2 color="var(--success)" /></div>
      </div>
      <div>Trạng thái: <StatusBadge status={student.status} /></div>
      {!showResult && <div className="alert alert-warning">Bài của bạn đã nộp nhưng chưa được giáo viên chấm xong, hoặc kỳ thi chưa bật hiển thị kết quả.</div>}
      {showResult && student.feedback && <div className="alert alert-success"><b>Nhận xét của giáo viên:</b><br />{student.feedback}</div>}
      {showResult && Object.keys(skillScores).length > 0 && (
        <div className="table-container">
          <table>
            <thead><tr><th>Kỹ năng</th><th>Điểm</th><th>Đúng/Tổng</th></tr></thead>
            <tbody>{Object.entries(skillScores).map(([skill, val]: any) => <tr key={skill}><td>{skill}</td><td>{val?.score10 ?? val?.score ?? '-'}</td><td>{val?.correct !== undefined ? `${val.correct}/${val.total}` : '-'}</td></tr>)}</tbody>
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
  const [scores, setScores] = useState<Record<number, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState(student?.feedback || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextScores: Record<number, number> = {};
    const nextFeedbacks: Record<number, string> = {};
    questions.forEach((q: any) => {
      const ans: any = answersByQuestion.get(Number(q.id));
      nextScores[q.id] = Number(ans?.score || 0);
      nextFeedbacks[q.id] = getAnswerFeedback(ans);
    });
    setScores(nextScores);
    setFeedbacks(nextFeedbacks);
  }, [questions, answersByQuestion]);

  const computed = useMemo(() => {
    const bySkill: Record<string, number[]> = { Writing: [], Speaking: [] };
    questions.forEach((q: any) => {
      if (q.skill === 'Writing' || q.skill === 'Speaking') bySkill[q.skill].push(Number(scores[q.id] || 0));
    });
    const skillScores: Record<string, any> = {};
    Object.entries(bySkill).forEach(([skill, values]) => {
      if (values.length) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        skillScores[skill] = { score10: Math.round(avg * 2) / 2 };
      }
    });
    const manualScore = questions.reduce((sum: number, q: any) => sum + Number(scores[q.id] || 0), 0);
    return { skillScores, manualScore };
  }, [questions, scores]);

  const save = async () => {
    if (!student?.id) return toast.error('Không tìm thấy bài thi của học viên');
    setSaving(true);
    try {
      const answerScores = questions.map((q: any) => ({
        questionId: q.id,
        answerId: answersByQuestion.get(Number(q.id))?.id,
        score: Number(scores[q.id] || 0),
        feedback: feedbacks[q.id] || '',
      }));
      await mockExamsApi.grade(student.id, { answerScores, skillScores: computed.skillScores, feedback: generalFeedback });
      toast.success('Đã chấm bài và cập nhật kết quả cho học viên');
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
        <div className="grid-2">
          <div className="stat-card"><div><div className="stat-value">{student?.objective_score ?? 0}</div><div className="stat-label">ĐIỂM TRẮC NGHIỆM TỰ ĐỘNG</div></div><FileCheck2 color="var(--primary)" /></div>
          <div className="stat-card"><div><div className="stat-value">{computed.manualScore}</div><div className="stat-label">ĐIỂM WRITING/SPEAKING</div></div><CheckCircle2 color="var(--success)" /></div>
        </div>

        {questions.length === 0 ? <EmptyState message="Bài thi này không có câu Writing/Speaking cần chấm thủ công" /> : questions.map((q: any, index: number) => {
          const ans: any = answersByQuestion.get(Number(q.id));
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
              </div>
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
          <Badge variant="blue">Writing: {computed.skillScores.Writing?.score10 ?? '-'}</Badge>
          <Badge variant="purple">Speaking: {computed.skillScores.Speaking?.score10 ?? '-'}</Badge>
          <Badge variant="green">Manual total: {computed.manualScore}</Badge>
        </div>
      </div>
    </Modal>
  );
}

export default function MockExamsPage() {
  const { user, tenantSlug } = useAuth();
  const navigate = useNavigate();
  const roles = user?.roles || [];
  const canManage = roles.includes('admin') || roles.includes('staff');
  const canDelete = roles.includes('admin');
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

  const statLabel = isStudent ? 'BÀI THI CỦA TÔI' : 'KỲ THI';
  const subtitle = isStudent
    ? 'Theo dõi kỳ thi được giao, trạng thái làm bài và điểm số của bạn'
    : isTeacher
      ? 'Xem bài nộp và chấm Writing/Speaking cho các lớp được phân công'
      : 'Lên lịch thi thử, gán lớp, theo dõi bài nộp và điểm số';

  const detailRows = useMemo(() => detail?.students || [], [detail]);
  const currentStudent = isStudent ? detailRows[0] : null;

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
                        {canManage || isTeacher ? <button className="btn btn-secondary btn-sm" onClick={() => view(r)}><UsersRound size={12} /> DS</button> : null}
                        {canManage && <button className="btn btn-secondary btn-sm" onClick={() => edit(r)}><Pencil size={12} /> Sửa</button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 size={12} /> Xoá</button>}
                        {isStudent && <button className="btn btn-secondary btn-sm" onClick={() => view(r)}><Eye size={12} /> Chi tiết</button>}
                        {isStudent && r.status === 'active' && !['graded'].includes(attemptStatus) && (
                          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/${tenantSlug}/student/mock-exams/${r.id}/take`)}><PlayCircle size={12} /> Vào thi</button>
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
        <Modal title={isStudent ? `Chi tiết kỳ thi - ${detail.title}` : `Danh sách học viên - ${detail.title}`} size="lg" onClose={() => setDetail(null)}>
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.length ? detailRows.map((s: any) => {
                    const canGradeStudent = ['submitted', 'graded'].includes(s.status) && s.latest_attempt_id;
                    return (
                      <tr key={s.id}>
                        <td>{s.full_name}</td>
                        <td>{s.email}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td>{s.latest_attempt_no || '-'}</td>
                        <td>{s.objective_score ?? '-'}</td>
                        <td>{s.manual_score ?? '-'}</td>
                        <td>{s.total_score ?? '-'}</td>
                        <td>{canGradeStudent ? <button className="btn btn-primary btn-sm" onClick={() => setGradingStudent(s)}><FileCheck2 size={12} /> Chấm</button> : <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>Chưa nộp</span>}</td>
                      </tr>
                    );
                  }) : <tr><td colSpan={8}><EmptyState /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
      {gradingStudent && detail && <GradingModal detail={detail} student={gradingStudent} onClose={() => setGradingStudent(null)} onSuccess={refreshDetail} />}
      {deleting && <ConfirmDialog message={`Xoá kỳ thi "${deleting.title}"?`} onCancel={() => setDeleting(null)} onConfirm={del} />}
    </div>
  );
}
