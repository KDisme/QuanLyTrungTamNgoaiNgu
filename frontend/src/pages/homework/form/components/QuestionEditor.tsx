import React from 'react';
import { FolderInput, Trash2 } from 'lucide-react';
import { Badge } from '../../../../components/common';
import { QUESTION_TYPES } from '../../form/utils/homework.constants.ts';
import { HomeworkQuestion } from '../../form/utils/homework.types.ts';

export default function QuestionEditor({
  question,
  index,
  disabledRemove,
  onChangeType,
  onChangeField,
  onChangeOption,
  onSaveToBank,
  onRemove,
}: {
  question: HomeworkQuestion;
  index: number;
  disabledRemove: boolean;
  onChangeType: (index: number, type: string) => void;
  onChangeField: (index: number, patch: Partial<HomeworkQuestion>) => void;
  onChangeOption: (questionIndex: number, optionIndex: number, patch: Partial<{ label: string; text: string }>) => void;
  onSaveToBank: (question: HomeworkQuestion) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 14, padding: 14, background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge variant="blue">Câu {index + 1}</Badge>
          <select
            className="form-select"
            style={{ width: 240 }}
            value={question.questionType}
            onChange={(e) => onChangeType(index, e.target.value)}
          >
            {QUESTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onSaveToBank(question)}
            title="Lưu câu này vào ngân hàng để dùng lại cho bài khác"
          >
            <FolderInput size={12} /> Lưu vào ngân hàng
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onRemove(index)} disabled={disabledRemove}>
            <Trash2 size={12} /> Xoá
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Nội dung câu hỏi <span className="required">*</span></label>
          <textarea
            className="form-textarea"
            rows={3}
            value={question.questionText}
            onChange={(e) => onChangeField(index, { questionText: e.target.value })}
            placeholder="Nhập câu hỏi, yêu cầu làm bài hoặc đề bài"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Ghi chú / gợi ý</label>
          <input
            className="form-input"
            value={question.helpText}
            onChange={(e) => onChangeField(index, { helpText: e.target.value })}
            placeholder="Gợi ý nếu cần"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Điểm</label>
          <input
            type="number"
            className="form-input"
            value={question.score}
            onChange={(e) => onChangeField(index, { score: Number(e.target.value) })}
          />
        </div>
      </div>

      {question.questionType === 'multiple_choice_4' && (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {question.options.map((option, optionIndex) => (
            <div key={option.label} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 8, alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{option.label}</div>
              <input
                className="form-input"
                value={option.text}
                onChange={(e) => onChangeOption(index, optionIndex, { text: e.target.value })}
                placeholder={`Đáp án ${option.label}`}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={question.correctAnswer === option.label}
                  onChange={() => onChangeField(index, { correctAnswer: option.label })}
                />
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
            <select
              className="form-select"
              value={question.correctAnswer}
              onChange={(e) => onChangeField(index, { correctAnswer: e.target.value })}
            >
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
  );
}