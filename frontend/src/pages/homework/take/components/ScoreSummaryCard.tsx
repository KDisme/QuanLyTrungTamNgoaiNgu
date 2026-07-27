import React from 'react';
import { CheckCircle2, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { StatusBadge } from '../../../../components/common';

export default function ScoreSummaryCard({
  scoreSummary,
  myStatus,
  detail,
  canRevealScore,
  canRevealAnswers,
}: {
  scoreSummary: { totalScore: any; status: any; feedback: string };
  myStatus: any;
  detail: any;
  canRevealScore: boolean;
  canRevealAnswers: boolean;
}) {
  return (
    <section style={{ borderRadius: 20, padding: 20, background: '#fff', border: '1px solid var(--gray-200)', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)', display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--primary-light)', display: 'grid', placeItems: 'center' }}>
            <CheckCircle2 color="var(--primary)" size={26} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', letterSpacing: 0.4 }}>ĐIỂM CỦA BẠN</div>
            {canRevealScore ? (
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{scoreSummary.totalScore} <span style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600 }}>/ {detail.totalScore ?? 100}</span></div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-500)' }}>Chưa công bố</div>
            )}
          </div>
        </div>
        <StatusBadge status={scoreSummary.status || myStatus} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: canRevealScore ? 'var(--primary-light)' : 'var(--gray-50)', color: canRevealScore ? 'var(--primary-dark)' : 'var(--gray-600)', fontSize: 13, fontWeight: 600 }}>
        {canRevealScore ? <Eye size={15} /> : <EyeOff size={15} />}
        {canRevealScore
          ? 'Giáo viên cho phép xem điểm — điểm và nhận xét hiển thị ngay khi có.'
          : 'Giáo viên chưa công bố điểm cho bài này. Bạn sẽ được thông báo khi có điểm.'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: canRevealAnswers ? 'var(--success-light)' : 'var(--gray-50)', color: canRevealAnswers ? '#059669' : 'var(--gray-600)', fontSize: 13, fontWeight: 600 }}>
        {canRevealAnswers ? <Eye size={15} /> : <EyeOff size={15} />}
        {canRevealAnswers
          ? 'Giáo viên cho phép xem đáp án — đáp án đúng được hiển thị bên dưới từng câu.'
          : 'Giáo viên chưa mở đáp án cho bài này.'}
      </div>

      {canRevealScore && scoreSummary.feedback && (
        <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 12, background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
          <MessageSquare size={18} color="var(--gray-500)" style={{ flex: 'none', marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 2 }}>NHẬN XÉT CỦA GIÁO VIÊN</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{scoreSummary.feedback}</div>
          </div>
        </div>
      )}
    </section>
  );
}