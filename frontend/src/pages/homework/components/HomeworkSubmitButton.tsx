import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/common';

export default function HomeworkSubmitButton({
  row,
  tenantSlug,
  navigate,
}: {
  row: any;
  tenantSlug: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const assignmentStatus = row.my_status || row.myStatus || row.status;
  const isViewOnly = assignmentStatus === 'graded' || assignmentStatus === 'submitted';
  const label = isViewOnly ? 'Xem bài' : 'Làm bài';

  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    const timeLimit = Number(row.timeLimitMinutes || row.time_limit_minutes || 0);
    const hasStarted = !!(row.myStartedAt || row.my_started_at);

    if (timeLimit > 0 && !hasStarted && !isViewOnly) {
      setShowConfirm(true);
    } else {
      navigate(`/${tenantSlug}/student/homework/${row.id}/take`);
    }
  };

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={handleClick}>{label}</button>

      {showConfirm && (
        <Modal
          title="⏱️ Xác nhận bắt đầu làm bài"
          size="md"
          onClose={() => setShowConfirm(false)}
          footer={(
            <>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={() => {
                setShowConfirm(false);
                navigate(`/${tenantSlug}/student/homework/${row.id}/take`);
              }}>Bắt đầu làm bài</button>
            </>
          )}
        >
          <div style={{ display: 'grid', gap: 14, padding: '10px 0' }}>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              Bài tập này có giới hạn thời gian làm bài là <strong style={{ color: 'var(--primary)', fontSize: 17 }}>{row.timeLimitMinutes || row.time_limit_minutes} phút</strong>.
            </div>
            <div style={{ fontSize: 14, color: '#991b1b', background: '#fff1f2', border: '1px solid #ffe4e6', borderRadius: 8, padding: 12, lineHeight: 1.5 }}>
              ⚠️ <strong>Lưu ý quan trọng:</strong> Khi bạn nhấn bắt đầu, đồng hồ đếm ngược sẽ chạy liên tục và <strong>không thể tạm dừng hoặc đặt lại</strong>, kể cả khi bạn đóng tab trình duyệt hay thoát ra ngoài. Hãy chắc chắn bạn đã chuẩn bị sẵn sàng và có kết nối mạng ổn định!
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}