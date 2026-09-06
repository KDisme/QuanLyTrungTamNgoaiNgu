import React from 'react';
import { ArrowLeft, Library, Plus, Users2, X } from 'lucide-react';
import { Badge } from '../../../../components/common/index.tsx';
import { useHomeworkForm } from '../hooks/useHomeworkForm.ts';
import BankPickerModal from './BankPickerModal.tsx';
import ClassPickerModal from './ClassPickerModal.tsx';
import QuestionEditor from '../components/QuestionEditor.tsx';
import ConfigTab from './ConfigTab.tsx';
import SecurityTab from './SecurityTab.tsx';
import { getMinDueDate } from '../utils/homework.helpers.ts';

const TABS = [
  { id: 'info', label: 'Thông tin' },
  { id: 'config', label: 'Cấu hình' },
  { id: 'security', label: 'Bảo mật' },
] as const;

export default function HomeworkFormBody({ initial, onDone }: { initial?: any; onDone: () => void }) {
  const {
    saving,
    tab,
    setTab,
    showBankPicker,
    setShowBankPicker,
    showClassPicker,
    setShowClassPicker,
    selectedClasses,
    form,
    setForm,
    setQuestion,
    changeQuestionType,
    updateOption,
    addQuestion,
    removeQuestion,
    insertFromBank,
    saveQuestionToBank,
    removeSelectedClass,
    confirmClassSelection,
    goNext,
    goPrev,
    submit,
  } = useHomeworkForm(initial, onDone);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={onDone}><ArrowLeft size={14} /> Quay lại</button>
        <h1 className="page-title" style={{ margin: 0 }}>{initial ? 'Sửa bài tập về nhà' : 'Tạo bài tập về nhà'}</h1>
        <div style={{ width: 96 }} />
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-100)', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
              color: tab === t.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Tiêu đề bài tập <span className="required">*</span></label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => setForm((prev: any) => ({ ...prev, title: e.target.value }))}
                placeholder="VD: Homework Unit 3 - Present Perfect"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Lớp áp dụng (có thể chọn nhiều lớp)</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowClassPicker(true)}>
                  <Users2 size={14} /> Chọn lớp
                </button>
              </div>

              {selectedClasses.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--gray-400)', padding: '10px 0' }}>Chưa chọn lớp nào — bấm "Chọn lớp" để bắt đầu.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedClasses.map((c) => (
                    <span
                      key={c.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999,
                        fontSize: 12, fontWeight: 600, color: 'var(--primary)',
                      }}
                    >
                      {c.name}{c.code ? ` (${c.code})` : ''}{c.primary_teacher_name ? ` — GV: ${c.primary_teacher_name}` : ''}
                      <button
                        type="button"
                        onClick={() => removeSelectedClass(c.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: 'var(--primary)' }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {selectedClasses.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
                  Bài tập sẽ giao cho toàn bộ học viên trong {selectedClasses.length} lớp đã chọn.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Hạn nộp</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.dueDate}
                min={getMinDueDate()}
                onChange={(e) => setForm((prev: any) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Điểm tối đa</label>
              <input
                type="number"
                className="form-input"
                value={form.totalScore}
                onChange={(e) => setForm((prev: any) => ({ ...prev, totalScore: e.target.value }))}
              />
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
            <textarea
              className="form-textarea"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
              placeholder="Mục tiêu, chương cần ôn, yêu cầu chung"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hướng dẫn làm bài</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm((prev: any) => ({ ...prev, instructions: e.target.value }))}
              placeholder="Mô tả đề, quy tắc làm bài, lưu ý nộp bài"
            />
          </div>

          <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 14, display: 'grid', gap: 10, background: '#fafafa' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.isAdaptive}
                onChange={(e) => setForm((prev: any) => ({ ...prev, isAdaptive: e.target.checked }))}
              />
              <div>
                <div style={{ fontWeight: 700 }}>Bài tập thiết ứng (IRT)</div>
                <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>
                  Hệ thống tự chọn câu hỏi từ ngân hàng dựa theo năng lực từng học sinh, không cần chọn sẵn câu hỏi.
                </div>
              </div>
            </label>
            {form.isAdaptive && (
              <div className="form-group" style={{ maxWidth: 220, marginLeft: 30 }}>
                <label className="form-label">Số câu hỏi mỗi học sinh sẽ làm</label>
                <input
                  type="number" min={1} className="form-input"
                  value={form.adaptiveQuestionCount}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, adaptiveQuestionCount: Number(e.target.value) }))}
                />
              </div>
            )}
          </div>

          {!form.isAdaptive && (
            <>
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
                {form.questions.map((question: any, index: number) => (
                  <QuestionEditor
                    key={`${index}-${question.questionType}`}
                    question={question}
                    index={index}
                    disabledRemove={form.questions.length === 1}
                    onChangeType={changeQuestionType}
                    onChangeField={setQuestion}
                    onChangeOption={updateOption}
                    onSaveToBank={saveQuestionToBank}
                    onRemove={removeQuestion}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'config' && <ConfigTab form={form} setForm={setForm} />}

      {tab === 'security' && <SecurityTab form={form} setForm={setForm} initial={initial} />}

      <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--gray-200)', padding: '14px 4px', marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={onDone}>Huỷ</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab !== 'info' && (
            <button className="btn btn-secondary" onClick={goPrev}>Quay lại</button>
          )}
          {tab !== 'security' ? (
            <button className="btn btn-primary" onClick={goNext}>Tiếp theo</button>
          ) : (
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu bài tập'}</button>
          )}
        </div>
      </div>

      {showBankPicker && <BankPickerModal onClose={() => setShowBankPicker(false)} onConfirm={insertFromBank} />}
      {showClassPicker && (
        <ClassPickerModal
          selectedIds={selectedClasses.map((c) => c.id)}
          onClose={() => setShowClassPicker(false)}
          onConfirm={confirmClassSelection}
        />
      )}
    </div>
  );
}