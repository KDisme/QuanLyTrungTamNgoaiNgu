import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlarmClockOff } from 'lucide-react';

export default function TimeUpScreen() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}><ArrowLeft size={14} /> Quay lại</button>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--danger-light)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        <AlarmClockOff color="var(--danger)" size={28} />
      </div>
      <h2 style={{ margin: '0 0 6px' }}>Đã hết thời gian làm bài</h2>
      <p style={{ color: 'var(--gray-500)' }}>Thời gian làm bài đã kết thúc, bạn không thể vào làm bài này nữa. Nếu bài đã kịp nộp trước đó, hãy liên hệ giáo viên để xem lại kết quả.</p>
    </div>
  );
}