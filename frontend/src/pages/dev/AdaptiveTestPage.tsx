// pages/dev/AdaptiveTestPage.tsx
// Trang TEST RIÊNG cho IRT — không phải giao diện làm bài thật, chỉ để kiểm chứng
// theta cập nhật đúng và câu hỏi được chọn hợp lý. Có thể xoá sau khi đã tin tưởng thuật toán.
import { useState } from 'react';
import { homeworkAdaptiveApi } from '../../api';

export default function AdaptiveTestPage() {
  const [assignmentId, setAssignmentId] = useState<number>(1);
  const [session, setSession] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const { data } = await homeworkAdaptiveApi.start(assignmentId);
      setSession(data.session);
      setQuestion(data.nextQuestion);
      setLog([{ event: 'start', theta: data.session.currentTheta }]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi bắt đầu phiên');
    } finally {
      setLoading(false);
    }
  };

  const answer = async (studentAnswer: string) => {
    if (!session || !question) return;
    setLoading(true);
    try {
      const { data } = await homeworkAdaptiveApi.answer(session.id, { questionId: question.id, studentAnswer });
      setSession(data.session);
      setQuestion(data.nextQuestion);
      setLog((prev) => [...prev, { event: data.wasCorrect ? 'ĐÚNG' : 'SAI', questionId: question.id, b: question.b, theta: data.session.currentTheta }]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi trả lời');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto', fontFamily: 'monospace' }}>
      <h2>Test IRT — Bài tập về nhà</h2>

      <div style={{ marginBottom: 16 }}>
        <label>Assignment ID: </label>
        <input
          type="number"
          value={assignmentId}
          onChange={(e) => setAssignmentId(Number(e.target.value))}
          style={{ width: 80, marginRight: 8 }}
        />
        <button onClick={start} disabled={loading}>Bắt đầu phiên (start)</button>
      </div>

      {session && (
        <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <b>Session #{session.id}</b> — theta hiện tại: <b>{session.currentTheta.toFixed(3)}</b>
          <br />Đã dùng: {JSON.stringify(session.usedQuestionIds)}
        </div>
      )}

      {question ? (
        <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div><b>Câu #{question.id}</b> (a={question.a}, b={question.b}, c={question.c})</div>
          <div style={{ margin: '8px 0' }}>{question.questionText}</div>
          {question.questionType === 'true_false' ? (
            <>
              <button onClick={() => answer('true')} disabled={loading} style={{ marginRight: 8 }}>Đúng</button>
              <button onClick={() => answer('false')} disabled={loading}>Sai</button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(question.options || []).map((opt: any) => (
                <button key={opt.label} onClick={() => answer(opt.label)} disabled={loading}>
                  {opt.label}. {opt.text}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : session ? (
        <div>Hết câu hỏi phù hợp trong ngân hàng.</div>
      ) : null}

      <div>
        <b>Log:</b>
        <pre style={{ background: '#111', color: '#0f0', padding: 12, borderRadius: 8, fontSize: 12 }}>
          {JSON.stringify(log, null, 2)}
        </pre>
      </div>
    </div>
  );
}