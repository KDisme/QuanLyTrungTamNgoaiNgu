// pages/homework/take/components/AdaptiveHomeworkTaker.tsx
// Giao diện làm bài tập THIẾT ỨNG (IRT) — thay thế trang test /dev/adaptive-test.
// Backend tự chọn câu theo năng lực, tự chấm điểm — component này chỉ hiển thị và gọi API.
import { useEffect, useState } from 'react';
import { homeworkAdaptiveApi } from '../../../../api';
import { Loading } from '../../../../components/common';

export default function AdaptiveHomeworkTaker({ assignmentId }: { assignmentId: number }) {
  const [session, setSession] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // feedback: hiện thoáng qua "Chính xác!"/"Chưa đúng" trước khi tự chuyển câu — không lộ đáp án đúng là gì.
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let mounted = true;
    homeworkAdaptiveApi.start(assignmentId).then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setQuestion(data.nextQuestion);
      setAnsweredCount(data.answeredCount);
      setTargetCount(data.targetCount);
      setFinished(!data.nextQuestion);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [assignmentId]);

  const handleAnswer = async (studentAnswer: string) => {
    if (!session || !question || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await homeworkAdaptiveApi.answer(session.id, { questionId: question.id, studentAnswer });
      setFeedback(data.wasCorrect ? 'correct' : 'incorrect');
      // Chờ 700ms để học sinh kịp thấy phản hồi, rồi mới chuyển câu — tránh cảm giác "giật cục" khi đổi UI đột ngột.
      setTimeout(() => {
        setSession(data.session);
        setQuestion(data.nextQuestion);
        setAnsweredCount(data.answeredCount);
        setTargetCount(data.targetCount);
        setFeedback(null);
        setFinished(!data.nextQuestion);
        setSubmitting(false);
      }, 700);
    } catch (err) {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  if (finished) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <h3>Bạn đã hoàn thành bài tập!</h3>
        <p style={{ color: 'var(--gray-500)' }}>Đã làm {answeredCount}/{targetCount} câu.</p>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--gray-500)' }}>
        <span>Câu {answeredCount + 1}/{targetCount}</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${(answeredCount / targetCount) * 100}%`, background: '#3b82f6', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{question.questionText}</div>

        {feedback ? (
          <div style={{
            padding: 12, borderRadius: 8, textAlign: 'center', fontWeight: 600,
            background: feedback === 'correct' ? '#dcfce7' : '#fee2e2',
            color: feedback === 'correct' ? '#16a34a' : '#dc2626',
          }}>
            {feedback === 'correct' ? '✓ Chính xác!' : '✗ Chưa đúng'}
          </div>
        ) : question.questionType === 'true_false' ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting} onClick={() => handleAnswer('true')}>Đúng</button>
            <button className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting} onClick={() => handleAnswer('false')}>Sai</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {(question.options || []).map((opt: any) => (
              <button
                key={opt.label}
                className="btn btn-secondary"
                style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                disabled={submitting}
                onClick={() => handleAnswer(opt.label)}
              >
                <b>{opt.label}.</b>&nbsp;{opt.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}