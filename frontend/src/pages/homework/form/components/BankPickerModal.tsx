import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { homeworkQuestionBankApi } from '../../../../api.ts';
import { Badge, EmptyState, Loading, Modal } from '../../../../components/common/index.tsx';
import { BANK_QUESTION_TYPES } from '../utils/homework.constants.ts';

function QuestionUsagePopover({ bankQuestionId, onClose }: { bankQuestionId: number; onClose: () => void }) {
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    homeworkQuestionBankApi.getUsage(bankQuestionId)
      .then((res) => { if (mounted) setUsage(res.data.usage || []); })
      .catch(() => { if (mounted) setUsage([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [bankQuestionId]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 41,
          width: 320, maxHeight: 300, overflowY: 'auto',
          background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12,
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.15)', padding: 12,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Câu hỏi này được dùng trong:</div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--gray-400)', padding: 8 }}>Đang tải...</div>
        ) : usage.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--gray-400)', padding: 8 }}>Không tìm thấy dữ liệu sử dụng.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {usage.map((u, idx) => (
              <div key={idx} style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: '8px 10px', background: 'var(--gray-50)' }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>{u.assignmentTitle}</div>
                <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 2 }}>
                  GV: {u.creatorName || 'Không rõ'} · Lớp: {u.classNames || 'Chưa gán lớp'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function BankPickerModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (items: any[]) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [category, setCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [usagePopoverId, setUsagePopoverId] = useState<number | null>(null);

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
                  {item.helpText && <div style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 4 }}>💡 {item.helpText}</div>}

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
                          {option.label}. {option.text} {option.label === item.correctAnswer && '✓'}
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
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative' }}>
                  <Badge variant="purple">{typeLabel(item.questionType)}</Badge>
                  {item.category && <Badge variant="blue">{item.category}</Badge>}
                  <Badge variant="gray">{item.score} điểm</Badge>
                  {Number(item.usageCount || item.usage_count || 0) > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setUsagePopoverId((prev) => (prev === item.id ? null : item.id));
                      }}
                      style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
                    >
                      <Badge variant="orange">Đã dùng {item.usageCount || item.usage_count} lần ▾</Badge>
                    </button>
                  )}
                  {usagePopoverId === item.id && (
                    <QuestionUsagePopover bankQuestionId={item.id} onClose={() => setUsagePopoverId(null)} />
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