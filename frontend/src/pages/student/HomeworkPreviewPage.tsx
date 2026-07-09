import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, FileText, ListChecks, Send } from 'lucide-react';
import { homeworkApi } from '../../api';
import { EmptyState, Loading, StatusBadge, Badge } from '../../components/common';

function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'Không có hạn nộp';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Không có hạn nộp';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function HomeworkPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    homeworkApi.getPreview(Number(id))
      .then((res) => { if (mounted) setDetail(res.data); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <Loading />;
  if (!detail) return <EmptyState message="Không tìm thấy bài tập" />;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 18 }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ width: 'fit-content' }}>
        <ArrowLeft size={14} /> Quay lại
      </button>

      <section style={{ borderRadius: 20, padding: 24, background: '#fff', border: '1px solid var(--gray-200)', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Badge variant="blue">{detail.className || 'Chưa gán lớp'}</Badge>
          <StatusBadge status={detail.myStatus || detail.status} />
        </div>
        <h1 className="page-title" style={{ margin: 0 }}>{detail.title}</h1>
        {detail.description && <p className="page-subtitle" style={{ marginTop: 8 }}>{detail.description}</p>}

        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)' }}>
            <Clock3 size={16} /> Hạn nộp: <b>{formatDateTime(detail.dueDate)}</b>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)' }}>
            <ListChecks size={16} /> Số câu hỏi: <b>{detail.questionCount || 0}</b>
          </div>
          {detail.myTotalScore != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)' }}>
              <FileText size={16} /> Điểm của bạn: <b>{detail.myTotalScore} / {detail.totalScore ?? 100}</b>
            </div>
          )}
        </div>

        {detail.instructions && (
          <div className="alert alert-info" style={{ marginTop: 18, whiteSpace: 'pre-wrap' }}>
            {detail.instructions}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => navigate('../../homework')}>
          <Send size={14} /> Đi tới Bài tập về nhà
        </button>
      </div>
    </div>
  );
}