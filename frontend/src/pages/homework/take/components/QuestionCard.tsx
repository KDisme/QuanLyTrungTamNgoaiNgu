import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '../../../../components/common';
import type { AnswerState, ResultState } from '../hooks/useHomeworkTake';

export default function QuestionCard({
  question,
  index,
  current,
  result,
  isLocked,
  canRevealAnswers,
  myStatus,
  setAnswer,
}: {
  question: any;
  index: number;
  current: AnswerState[number] | undefined;
  result: ResultState[number] | undefined;
  isLocked: boolean;
  canRevealAnswers: boolean;
  myStatus: any;
  setAnswer: (questionId: number, patch: Partial<{ answerText: string; selectedAnswer: string }>) => void;
}) {
  const answer = current || {};
  const showResult = isLocked && canRevealAnswers && question.questionType !== 'essay' && result?.isCorrect !== undefined;
  const cardClass = showResult ? (result?.isCorrect ? 'hw-question-card is-graded-correct' : 'hw-question-card is-graded-wrong') : 'hw-question-card';

  return (
    <div className={cardClass}>
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
            const isSelected = answer.selectedAnswer === option.value;
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
            const isSelected = answer.selectedAnswer === option.label;
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
        <textarea className="form-textarea" rows={8} disabled={isLocked} value={answer.answerText || ''} onChange={(e) => setAnswer(question.id, { answerText: e.target.value })} placeholder="Nhập bài làm của bạn" style={{ resize: 'vertical', minHeight: 180 }} />
      )}
    </div>
  );
}