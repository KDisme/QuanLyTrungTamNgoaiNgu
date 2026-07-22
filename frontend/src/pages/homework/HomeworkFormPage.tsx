import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Library, FolderInput, Search, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { classesApi, homeworkApi, homeworkQuestionBankApi } from '../../api';
import { Badge, EmptyState, Loading, Modal } from '../../components/common';

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
  bankQuestionId?: number | null;
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

function toLocalISOString(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const BANK_QUESTION_TYPES = QUESTION_TYPES;

function BankPickerModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (items: any[]) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [category, setCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await homeworkQuestionBankApi.getAll({ search, questionType, category, limit: 200 });
      setItems(res.data.items || []);
      setCategories(res.data.categories || []);
    } finally {
      setLoading(false);
    }
  }, [search, questionType, category]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const typeLabel = (type: string) => BANK_QUESTION_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <Modal
      title="Chọn câu hỏi từ ngân hàng"
      size="xl"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          <button
            className="btn btn-primary"
            disabled={selectedIds.size === 0}
            onClick={() => onConfirm(items.filter((item) => selectedIds.has(item.id)))}
          >
            Thêm {selectedIds.size > 0 ? `${selectedIds.size} câu` : ''} vào bài
          </button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="filter-bar">
          <div className="search-input">
            <Search className="search-icon" size={14} />
            <input className="form-input" placeholder="Tìm câu hỏi..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 200 }} value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
            <option value="">Tất cả dạng câu hỏi</option>
            {BANK_QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="form-select" style={{ width: 180 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tất cả chủ đề</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? <Loading /> : items.length === 0 ? (
          <EmptyState message="Ngân hàng chưa có câu hỏi phù hợp. Hãy soạn câu hỏi trong bài rồi bấm 'Lưu vào ngân hàng' để dùng lại sau." />
        ) : (
          <div style={{ display: 'grid', gap: 10, maxHeight: 560, overflowY: 'auto' }}>
            {items.map((item) => (
              <label
                key={item.id}
                style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'start',
                  padding: 16, border: '1px solid var(--gray-200)', borderRadius: 12, cursor: 'pointer',
                  background: selectedIds.has(item.id) ? '#eff6ff' : '#fff',
                }}
              >
                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.5 }}>{item.questionText}</div>
                  {item.helpText && <div style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 4 }}> {item.helpText}</div>}

                  {item.questionType === 'multiple_choice_4' && Array.isArray(item.options) && item.options.length > 0 && (
                    <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
                      {item.options.map((option: any) => (
                        <div
                          key={option.label}
                          style={{
                            fontSize: 13, padding: '5px 10px', borderRadius: 6,
                            background: option.label === item.correctAnswer ? '#dcfce7' : 'var(--gray-50)',
                            color: option.label === item.correctAnswer ? '#166534' : 'var(--gray-700)',
                            fontWeight: option.label === item.correctAnswer ? 700 : 400,
                          }}
                        >
                          {option.label}. {option.text} {option.label === item.correctAnswer}
                        </div>
                      ))}
                    </div>
                  )}

                  {item.questionType === 'true_false' && (
                    <div style={{ fontSize: 13, marginTop: 10, fontWeight: 700, color: '#166534', background: '#dcfce7', display: 'inline-block', padding: '4px 10px', borderRadius: 6 }}>
                      Đáp án đúng: {item.correctAnswer === 'true' ? 'Đúng' : 'Sai'}
                    </div>
                  )}

                  {item.questionType === 'essay' && (
                    <div style={{ fontSize: 12, marginTop: 10, color: 'var(--gray-500)', fontStyle: 'italic' }}>
                      Tự luận — giáo viên chấm thủ công
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Badge variant="purple">{typeLabel(item.questionType)}</Badge>
                  {item.category && <Badge variant="blue">{item.category}</Badge>}
                  <Badge variant="gray">{item.score} điểm</Badge>
                  {Number(item.usageCount || item.usage_count || 0) > 0 && (
                    <Badge variant="orange">Đã dùng {item.usageCount || item.usage_count} lần</Badge>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function HomeworkFormBody({ initial, onDone }: { initial?: any; onDone: () => void }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'config' | 'security'>('info');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<any>({
    title: initial?.title || '',
    description: initial?.description || '',
    instructions: initial?.instructions || '',
    classIds: initial?.classIds || (initial?.class_id ? [initial.class_id] : []),
    dueDate: toLocalISOString(initial?.due_date || initial?.dueDate),
    allowLateSubmission: initial?.allow_late_submission ?? initial?.allowLateSubmission ?? false,
    totalScore: initial?.total_score || initial?.totalScore || 100,
    status: initial?.status || 'draft',
    showAnswersAfterSubmit: initial?.show_answers_after_submit ?? initial?.showAnswersAfterSubmit ?? false,
    showScoreAfterSubmit: initial?.show_score_after_submit ?? initial?.showScoreAfterSubmit ?? true,
    requirePassword: initial?.require_password ?? initial?.requirePassword ?? false,
    hasTimeLimit: !!(initial?.time_limit_minutes ?? initial?.timeLimitMinutes),
    timeLimitMinutes: initial?.time_limit_minutes ?? initial?.timeLimitMinutes ?? 30,
    shuffleQuestions: initial?.shuffle_questions ?? initial?.shuffleQuestions ?? false,
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

  const insertFromBank = (items: any[]) => {
    setForm((prev: any) => {
      const startOrder = prev.questions.length + 1;
      const converted: HomeworkQuestion[] = items.map((item, index) => ({
        orderNumber: startOrder + index,
        bankQuestionId: item.id,
        questionType: item.questionType,
        questionText: item.questionText,
        helpText: item.helpText || '',
        isRequired: true,
        score: item.score || 1,
        correctAnswer: item.correctAnswer || '',
        options: Array.isArray(item.options) ? item.options.map((o: any) => ({ label: o.label, text: o.text })) : [],
      }));
      return { ...prev, questions: [...prev.questions, ...converted] };
    });
    toast.success(`Đã thêm ${items.length} câu từ ngân hàng vào bài`);
    setShowBankPicker(false);
  };

  const saveQuestionToBank = async (question: HomeworkQuestion) => {
    if (!question.questionText.trim()) return toast.error('Câu hỏi chưa có nội dung để lưu');
    try {
      await homeworkQuestionBankApi.create({
        questionType: question.questionType,
        questionText: question.questionText,
        helpText: question.helpText,
        score: question.score,
        correctAnswer: question.correctAnswer,
        options: question.options,
      });
      toast.success('Đã lưu câu hỏi vào ngân hàng để dùng lại sau');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được vào ngân hàng');
    }
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
      bankQuestionId: question.bankQuestionId || null,
    }));

    setSaving(true);
    try {
      const payload = {
        ...form,
        classIds: (form.classIds || []).map(Number),
        totalScore: Number(form.totalScore || 100),
        timeLimitMinutes: form.hasTimeLimit ? Number(form.timeLimitMinutes || 30) : null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        questions,
      };
      if (initial) await homeworkApi.update(initial.id, payload);
      else await homeworkApi.create(payload);
      toast.success('Đã lưu bài tập về nhà');
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được bài tập');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={onDone}><ArrowLeft size={14} /> Quay lại</button>
        <h1 className="page-title" style={{ margin: 0 }}>{initial ? 'Sửa bài tập về nhà' : 'Tạo bài tập về nhà'}</h1>
        <div style={{ width: 96 }} />
      </div>

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
              <label className="form-label">Tiêu đề bài tập <span className="required">*</span></label>
              <input className="form-input" value={form.title} onChange={(e) => setForm((prev: any) => ({ ...prev, title: e.target.value }))} placeholder="VD: Homework Unit 3 - Present Perfect" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Lớp áp dụng (có thể chọn nhiều lớp)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                    background: '#eff6ff', padding: '3px 10px', borderRadius: 999,
                  }}>
                    Đã chọn {(form.classIds || []).length}/{classes.length} lớp
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setForm((prev: any) => {
                        const allSelected = classes.length > 0 && (prev.classIds || []).length === classes.length;
                        return { ...prev, classIds: allSelected ? [] : classes.map((c) => c.id) };
                      });
                    }}
                  >
                    {classes.length > 0 && (form.classIds || []).length === classes.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                </div>
              </div>

              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12,
                border: '1px solid var(--gray-200)', borderRadius: 10, maxHeight: 160, overflowY: 'auto',
              }}>
                {classes.length === 0 && <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Chưa có lớp nào</span>}
                {classes.map((item) => {
                  const checked = (form.classIds || []).includes(item.id);
                  return (
                    <label
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                        border: '1px solid var(--gray-200)', borderRadius: 999, cursor: 'pointer',
                        background: checked ? '#eff6ff' : '#fff', fontSize: 13, fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm((prev: any) => {
                            const current: number[] = prev.classIds || [];
                            const next = e.target.checked
                              ? [...current, item.id]
                              : current.filter((id: number) => id !== item.id);
                            return { ...prev, classIds: next };
                          });
                        }}
                      />
                      {item.name}
                    </label>
                  );
                })}
              </div>

              {(form.classIds || []).length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                  Bài tập sẽ giao cho toàn bộ học viên trong {(form.classIds || []).length} lớp đã chọn.
                </div>
              )}
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowBankPicker(true)}><Library size={14} /> Chọn từ ngân hàng</button>
              <button className="btn btn-secondary" onClick={addQuestion}><Plus size={14} /> Thêm câu</button>
            </div>
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
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => saveQuestionToBank(question)} title="Lưu câu này vào ngân hàng để dùng lại cho bài khác"><FolderInput size={12} /> Lưu vào ngân hàng</button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(index)} disabled={form.questions.length === 1}><Trash2 size={12} /> Xoá</button>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Nội dung câu hỏi <span className="required">*</span></label>
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
          <div className="toggle-row">
            <div className="toggle-row-text">
              <div className="toggle-row-title">Giới hạn thời gian làm bài</div>
              <div className="toggle-row-desc">
                {form.hasTimeLimit
                  ? `Bật: khi học viên bắt đầu làm bài, đồng hồ đếm ngược ${form.timeLimitMinutes || 0} phút sẽ chạy. Hết giờ, bài tự đóng lại, học viên không vào làm tiếp được nữa.`
                  : 'Tắt: học viên làm bài không giới hạn thời gian (chỉ phụ thuộc hạn nộp).'}
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!!form.hasTimeLimit}
                onChange={(e) => setForm((prev: any) => ({ ...prev, hasTimeLimit: e.target.checked }))}
              />
              <span className="toggle-track" />
            </label>
          </div>

          {form.hasTimeLimit && (
            <div className="form-group" style={{ maxWidth: 240 }}>
              <label className="form-label">Thời gian làm bài (phút)</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={form.timeLimitMinutes}
                onChange={(e) => setForm((prev: any) => ({ ...prev, timeLimitMinutes: e.target.value }))}
                placeholder="VD: 30"
              />
            </div>
          )}

          <div className="toggle-row">
            <div className="toggle-row-text">
              <div className="toggle-row-title">Xáo trộn câu hỏi và đáp án</div>
              <div className="toggle-row-desc">
                {form.shuffleQuestions
                  ? 'Bật: mỗi học viên sẽ thấy thứ tự câu hỏi và thứ tự đáp án (A/B/C/D) khác nhau, hạn chế nhìn bài nhau. Thứ tự được giữ cố định trong suốt quá trình học viên làm bài.'
                  : 'Tắt: tất cả học viên thấy câu hỏi và đáp án theo đúng thứ tự giáo viên đã soạn.'}
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!!form.shuffleQuestions}
                onChange={(e) => setForm((prev: any) => ({ ...prev, shuffleQuestions: e.target.checked }))}
              />
              <span className="toggle-track" />
            </label>
          </div>

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
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: 40 }}
                  value={form.password}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, password: e.target.value }))}
                  placeholder={(initial?.require_password || initial?.requirePassword) ? 'Để trống nếu không muốn đổi mật khẩu' : 'Nhập mật khẩu học viên sẽ dùng'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    display: 'flex', color: 'var(--gray-400)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
                Đọc mật khẩu này cho học viên trước giờ làm bài. Giáo viên/Admin luôn xem được đề mà không cần mật khẩu.
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--gray-200)', padding: '14px 4px', marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={onDone}>Huỷ</button>
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
      </div>

      {showBankPicker && <BankPickerModal onClose={() => setShowBankPicker(false)} onConfirm={insertFromBank} />}
    </div>
  );
}

export default function HomeworkFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [initial, setInitial] = useState<any>(null);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    setLoading(true);
    homeworkApi.getById(Number(id))
      .then((res) => { if (mounted) setInitial(res.data); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id, isEdit]);

  const goBack = () => navigate(-1);

  if (loading) return <Loading />;
  if (isEdit && !initial) return <EmptyState message="Không tìm thấy bài tập" />;

  return <HomeworkFormBody initial={initial} onDone={goBack} />;
}