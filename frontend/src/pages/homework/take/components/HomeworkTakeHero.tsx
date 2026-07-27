import React from 'react';
import { Sparkles, Clock3, Eye, EyeOff, Timer } from 'lucide-react';
import { Badge, StatusBadge } from '../../../../components/common';
import ProgressRing from './ProgressRing';
import { formatDateTime } from '../utils/homeworkTake.helpers';

export default function HomeworkTakeHero({
  detail,
  isLocked,
  completionRate,
  secondsLeft,
  canEdit,
  canRevealAnswers,
  totalQuestions,
}: {
  detail: any;
  isLocked: boolean;
  completionRate: number;
  secondsLeft: number | null;
  canEdit: boolean;
  canRevealAnswers: boolean;
  totalQuestions: number;
}) {
  const deadlineText = detail.dueDate ? formatDateTime(detail.dueDate) : 'Không có hạn nộp';

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge variant="blue">{detail.className || detail.class_name || 'Chưa gán lớp'}</Badge>
        <StatusBadge status={detail.status} />
        {isLocked && <Badge variant="green">Đã nộp</Badge>}
      </div>

      <section style={{ borderRadius: 24, padding: 24, background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%)', border: '1px solid var(--gray-200)', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr auto 1fr', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 12, marginBottom: 12 }}>
              <Sparkles size={14} /> Homework
            </div>
            <h1 className="page-title" style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>{detail.title}</h1>
            <p className="page-subtitle" style={{ marginTop: 10, maxWidth: 860 }}>{detail.description || 'Bài tập về nhà do giáo viên giao'}</p>
            {detail.instructions && <div className="alert alert-info" style={{ marginTop: 18, whiteSpace: 'pre-wrap' }}>{detail.instructions}</div>}
          </div>

          {!isLocked && <ProgressRing percent={completionRate} />}

          <div style={{ display: 'grid', gap: 12 }}>
            {secondsLeft !== null && canEdit && (
              <div className="stat-card" style={{ minHeight: 96, background: secondsLeft <= 60 ? 'var(--danger-light)' : undefined, borderColor: secondsLeft <= 60 ? '#fecaca' : undefined }}>
                <div>
                  <div className="stat-value" style={{ color: secondsLeft <= 60 ? 'var(--danger)' : undefined, fontVariantNumeric: 'tabular-nums' }}>
                    {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                  </div>
                  <div className="stat-label">THỜI GIAN CÒN LẠI</div>
                </div>
                <Timer color={secondsLeft <= 60 ? 'var(--danger)' : 'var(--primary)'} />
              </div>
            )}
            <div className="stat-card" style={{ minHeight: 96 }}>
              <div>
                <div className="stat-value">{deadlineText}</div>
                <div className="stat-label">HẠN NỘP</div>
              </div>
              <Clock3 color="var(--primary)" />
            </div>
            <div className="stat-card" style={{ minHeight: 96 }}>
              <div>
                <div className="stat-value">{totalQuestions} câu</div>
                <div className="stat-label">SỐ CÂU HỎI</div>
              </div>
              {canRevealAnswers ? <Eye color="var(--success)" /> : <EyeOff color="var(--gray-400)" />}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}