import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import {
  apiCreateExamSet,
  apiDeleteExamSet,
  apiGetAllExamSets,
  apiGetExamSetById,
  apiUpdateExamSet,
  ExamQuestionPayload,
} from '../api/examSetService';

import '../styles/form.css';
import '../styles/table.css';

interface ExamSetItem {
  id: number;
  name: string;
  exam_at: string;
  question_count: number;
  created_at: string;
}

interface ExamSetDetail extends ExamSetItem {
  questions: Array<ExamQuestionPayload & { id: number; order_no: number }>;
}

const createEmptyQuestions = (count: number): ExamQuestionPayload[] =>
  Array.from({ length: count }, () => ({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
  }));

const toEditableQuestions = (
  questions: Array<Partial<ExamQuestionPayload>> | undefined,
  questionCount: number
): ExamQuestionPayload[] => {
  const source = Array.isArray(questions) ? questions.slice(0, questionCount) : [];

  return Array.from({ length: questionCount }, (_, idx) => {
    const question = source[idx];
    return {
      question_text: question?.question_text || '',
      option_a: question?.option_a || '',
      option_b: question?.option_b || '',
      option_c: question?.option_c || '',
      option_d: question?.option_d || '',
      correct_option:
        question?.correct_option === 'A' ||
        question?.correct_option === 'B' ||
        question?.correct_option === 'C' ||
        question?.correct_option === 'D'
          ? question.correct_option
          : 'A',
    };
  });
};

const ExamSetManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [examSets, setExamSets] = useState<ExamSetItem[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingExamSetId, setEditingExamSetId] = useState<number | null>(null);
  const [isCreateQuestionCountConfirmed, setIsCreateQuestionCountConfirmed] = useState(false);

  const [currentDetail, setCurrentDetail] = useState<ExamSetDetail | null>(null);

  const [form, setForm] = useState({
    name: '',
    exam_at: '',
    question_count: 0,
    questions: [] as ExamQuestionPayload[],
  });

  const resizeQuestions = (questions: ExamQuestionPayload[], count: number): ExamQuestionPayload[] => {
    if (count <= 0) return [];
    if (questions.length === count) return questions;
    if (questions.length > count) return questions.slice(0, count);
    return [...questions, ...createEmptyQuestions(count - questions.length)];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGetAllExamSets();
      // apiGetAllExamSets() đã normalize/mapping dữ liệu -> res.data luôn là ExamSetItem[]
      setExamSets(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return examSets;
    return examSets.filter((e) => e.name.toLowerCase().includes(kw));
  }, [examSets, keyword]);

  const resetForm = () => {
    setForm({
      name: '',
      exam_at: '',
      question_count: 0,
      questions: [] as ExamQuestionPayload[],
    });
    setIsCreateQuestionCountConfirmed(false);
  };

  const handleConfirmCreateQuestionCount = () => {
    if (form.question_count < 1) {
      alert('Số lượng câu hỏi phải lớn hơn hoặc bằng 1');
      return;
    }

    setForm((prev) => ({
      ...prev,
      questions: resizeQuestions(prev.questions, prev.question_count),
    }));
    setIsCreateQuestionCountConfirmed(true);
  };

  const handleQuestionChange = (index: number, field: keyof ExamQuestionPayload, value: string) => {
    setForm((prev) => {
      const nextQuestions = [...prev.questions];
      nextQuestions[index] = {
        ...nextQuestions[index],
        [field]: value,
      };
      return { ...prev, questions: nextQuestions };
    });
  };

  const validateForm = (): string => {
    if (!form.name.trim()) return 'Tên bộ đề thi không được để trống';
    if (!form.exam_at) return 'Thời gian thi không được để trống';
    if (form.question_count < 1) return 'Số lượng câu hỏi phải lớn hơn hoặc bằng 1';
    if (form.questions.length !== form.question_count) {
      return 'Số lượng câu hỏi không khớp với dữ liệu câu hỏi';
    }

    for (let i = 0; i < form.questions.length; i += 1) {
      const q = form.questions[i];
      if (!q.question_text.trim()) return `Câu ${i + 1}: thiếu nội dung câu hỏi`;
      if (!q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
        return `Câu ${i + 1}: cần đủ 4 đáp án`;
      }
    }

    return '';
  };

  const handleCreateExamSet = async () => {
    const err = validateForm();
    if (err) {
      alert(err);
      return;
    }

    try {
      await apiCreateExamSet({
        name: form.name.trim(),
        exam_at: new Date(form.exam_at).toISOString(),
        question_count: form.question_count,
        questions: form.questions,
      });
      setShowCreate(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Tạo bộ đề thất bại');
    }
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const res = await apiGetExamSetById(id);
      const data: ExamSetDetail = res.data?.exam_set || res.data?.data || res.data;

      setEditingExamSetId(id);
      setForm({
        name: data.name || '',
        exam_at: dayjs(data.exam_at).format('YYYY-MM-DDTHH:mm'),
        question_count: Number(data.question_count) || data.questions?.length || 1,
        questions: toEditableQuestions(
          data.questions,
          Number(data.question_count) || data.questions?.length || 1
        ),
      });
      setShowEdit(true);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể tải dữ liệu để chỉnh sửa');
    }
  };

  const handleUpdateExamSet = async () => {
    if (!editingExamSetId) return;

    const err = validateForm();
    if (err) {
      alert(err);
      return;
    }

    try {
      await apiUpdateExamSet(editingExamSetId, {
        name: form.name.trim(),
        exam_at: new Date(form.exam_at).toISOString(),
        question_count: form.question_count,
        questions: form.questions,
      });
      setShowEdit(false);
      setEditingExamSetId(null);
      resetForm();
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Cập nhật bộ đề thất bại');
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const res = await apiGetExamSetById(id);
      const data: ExamSetDetail = res.data?.exam_set || res.data?.data || res.data;
      setCurrentDetail(data);
      setShowDetail(true);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể tải chi tiết bộ đề');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xóa bộ đề thi này?')) return;
    try {
      await apiDeleteExamSet(id);
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể xóa bộ đề');
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản lý Bộ đề thi</h1>
          <p className="page-subtitle">Tạo và quản lý bộ đề thi</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          <Plus size={18} />
          Tạo bộ đề thi
        </button>
      </div>

      <div className="searchbar">
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          placeholder="Tìm theo tên bộ đề..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Mã</th>
                <th>Tên bộ đề</th>
                <th style={{ width: 180 }}>Thời gian thi</th>
                <th className="th-center" style={{ width: 120 }}>Số câu hỏi</th>
                <th className="th-right" style={{ width: 140 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="row-empty">{loading ? 'Đang tải dữ liệu...' : 'Chưa có bộ đề thi'}</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="td-center">BD{String(item.id).padStart(3, '0')}</td>
                    <td className="td-strong">{item.name}</td>
                    <td>{dayjs(item.exam_at).format('DD/MM/YYYY HH:mm')}</td>
                    <td className="td-center">{item.question_count}</td>
                    <td className="td-right">
                      <span className="actions">
                        <button className="icon-btn view" onClick={() => handleViewDetail(item.id)} title="Xem chi tiết">
                          <Eye size={16} />
                        </button>
                        <button className="icon-btn edit" onClick={() => handleOpenEdit(item.id)} title="Chỉnh sửa bộ đề">
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn delete" onClick={() => handleDelete(item.id)} title="Xóa bộ đề">
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">Hiển thị {filtered.length} / {examSets.length} bộ đề</div>
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetForm();
        }}
        title="Tạo Bộ đề thi"
        maxWidth={980}
      >
        <div className="form" style={{ gap: 16 }}>
          <div className="form-row-2">
            <div className="field">
              <label className="label">Tên bộ đề</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ví dụ: Đề thi thử IELTS Foundation"
              />
            </div>
            <div className="field">
              <label className="label">Thời gian thi (ngày, giờ)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.exam_at}
                onChange={(e) => setForm((prev) => ({ ...prev, exam_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-row-2" style={{ alignItems: 'end' }}>
            <div className="field" style={{ maxWidth: 220 }}>
              <label className="label">Số lượng câu hỏi trong đề</label>
              <input
                className="input"
                type="number"
                min={1}
                value={form.question_count === 0 ? '' : form.question_count}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    question_count: Number.isNaN(value) ? 0 : value,
                    questions: [],
                  }));
                  setIsCreateQuestionCountConfirmed(false);
                }}
              />
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label className="label">&nbsp;</label>
              <button className="btn-save" type="button" onClick={handleConfirmCreateQuestionCount}>
                Xác nhận
              </button>
            </div>
          </div>

          {isCreateQuestionCountConfirmed && form.question_count > 0 ? (
            <div className="card" style={{ padding: 16, borderRadius: 14 }}>
              <h3 style={{ margin: '0 0 12px 0' }}>{form.question_count} câu hỏi trắc nghiệm</h3>
              <div className="form" style={{ gap: 18 }}>
                {form.questions.map((q, idx) => (
                  <div key={idx} className="card" style={{ padding: 14, borderRadius: 12 }}>
                    <div className="field">
                      <label className="label">Câu {idx + 1}</label>
                      <input
                        className="input"
                        value={q.question_text}
                        onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                        placeholder={`Nhập nội dung câu hỏi ${idx + 1}`}
                      />
                    </div>

                    <div className="form-row-2">
                      <div className="field">
                        <label className="label">Đáp án A</label>
                        <input className="input" value={q.option_a} onChange={(e) => handleQuestionChange(idx, 'option_a', e.target.value)} />
                      </div>
                      <div className="field">
                        <label className="label">Đáp án B</label>
                        <input className="input" value={q.option_b} onChange={(e) => handleQuestionChange(idx, 'option_b', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="field">
                        <label className="label">Đáp án C</label>
                        <input className="input" value={q.option_c} onChange={(e) => handleQuestionChange(idx, 'option_c', e.target.value)} />
                      </div>
                      <div className="field">
                        <label className="label">Đáp án D</label>
                        <input className="input" value={q.option_d} onChange={(e) => handleQuestionChange(idx, 'option_d', e.target.value)} />
                      </div>
                    </div>

                    <div className="field" style={{ maxWidth: 220 }}>
                      <label className="label">Đáp án đúng</label>
                      <select
                        className="input"
                        value={q.correct_option}
                        onChange={(e) => handleQuestionChange(idx, 'correct_option', e.target.value)}
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: '#64748b' }}>Nhập số lượng câu hỏi rồi bấm Xác nhận để hiển thị form nhập câu hỏi và đáp án.</p>
          )}

          <div className="form-actions" style={{ marginTop: 8 }}>
            <button className="btn-outline" type="button" onClick={() => { setShowCreate(false); resetForm(); }}>
              Hủy
            </button>
            <button className="btn-save" type="button" onClick={handleCreateExamSet}>
              Lưu bộ đề thi
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Chỉnh sửa Bộ đề thi" maxWidth={980}>
        <div className="form" style={{ gap: 16 }}>
          <div className="form-row-2">
            <div className="field">
              <label className="label">Tên bộ đề</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ví dụ: Đề thi thử IELTS Foundation"
              />
            </div>
            <div className="field">
              <label className="label">Thời gian thi (ngày, giờ)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.exam_at}
                onChange={(e) => setForm((prev) => ({ ...prev, exam_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="field" style={{ maxWidth: 220 }}>
            <label className="label">Số lượng câu hỏi trong đề</label>
            <input
              className="input"
              type="number"
              min={1}
              value={form.question_count === 0 ? '' : form.question_count}
              onChange={(e) => {
                const value = Number(e.target.value);
                setForm((prev) => {
                  const nextCount = Number.isNaN(value) ? 0 : value;
                  return {
                    ...prev,
                    question_count: nextCount,
                    questions: resizeQuestions(prev.questions, nextCount),
                  };
                });
              }}
            />
          </div>

          <div className="card" style={{ padding: 16, borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>{form.question_count} câu hỏi trắc nghiệm</h3>
            <div className="form" style={{ gap: 18 }}>
              {form.questions.map((q, idx) => (
                <div key={idx} className="card" style={{ padding: 14, borderRadius: 12 }}>
                  <div className="field">
                    <label className="label">Câu {idx + 1}</label>
                    <input
                      className="input"
                      value={q.question_text}
                      onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                      placeholder={`Nhập nội dung câu hỏi ${idx + 1}`}
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="field">
                      <label className="label">Đáp án A</label>
                      <input className="input" value={q.option_a} onChange={(e) => handleQuestionChange(idx, 'option_a', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label">Đáp án B</label>
                      <input className="input" value={q.option_b} onChange={(e) => handleQuestionChange(idx, 'option_b', e.target.value)} />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="field">
                      <label className="label">Đáp án C</label>
                      <input className="input" value={q.option_c} onChange={(e) => handleQuestionChange(idx, 'option_c', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label">Đáp án D</label>
                      <input className="input" value={q.option_d} onChange={(e) => handleQuestionChange(idx, 'option_d', e.target.value)} />
                    </div>
                  </div>

                  <div className="field" style={{ maxWidth: 220 }}>
                    <label className="label">Đáp án đúng</label>
                    <select
                      className="input"
                      value={q.correct_option}
                      onChange={(e) => handleQuestionChange(idx, 'correct_option', e.target.value)}
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: 8 }}>
            <button
              className="btn-outline"
              type="button"
              onClick={() => {
                setShowEdit(false);
                setEditingExamSetId(null);
                resetForm();
              }}
            >
              Hủy
            </button>
            <button className="btn-save" type="button" onClick={handleUpdateExamSet}>
              Lưu chỉnh sửa
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Chi tiết Bộ đề thi" maxWidth={900}>
        {currentDetail && (
          <div className="form" style={{ gap: 14 }}>
            <div className="form-row-2">
              <div className="field">
                <label className="label">Tên bộ đề</label>
                <div className="input">{currentDetail.name}</div>
              </div>
              <div className="field">
                <label className="label">Thời gian thi</label>
                <div className="input">{dayjs(currentDetail.exam_at).format('DD/MM/YYYY HH:mm')}</div>
              </div>
            </div>

            <div className="field" style={{ maxWidth: 220 }}>
              <label className="label">Số lượng câu hỏi</label>
              <div className="input">{currentDetail.question_count}</div>
            </div>

            <div className="form" style={{ gap: 12 }}>
              {currentDetail.questions?.map((q, idx) => (
                <div key={q.id || idx} className="card" style={{ padding: 12, borderRadius: 10 }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
                    Câu {idx + 1}: {q.question_text}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>A. {q.option_a}</div>
                    <div>B. {q.option_b}</div>
                    <div>C. {q.option_c}</div>
                    <div>D. {q.option_d}</div>
                  </div>
                  <p style={{ margin: '8px 0 0 0', color: '#166534', fontWeight: 700 }}>Đáp án đúng: {q.correct_option}</p>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button className="btn-outline" type="button" onClick={() => setShowDetail(false)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExamSetManagement;
