import React from 'react';
import { Send } from 'lucide-react';

export default function SubmitBar({
  lastDraftSavedTime,
  draftStatus,
  saving,
  answeredCount,
  totalQuestions,
  onSaveDraft,
  onSubmit,
}: {
  lastDraftSavedTime: string | null;
  draftStatus: 'idle' | 'saving' | 'saved' | 'error';
  saving: boolean;
  answeredCount: number;
  totalQuestions: number;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  return (
    <div style={{ position: 'sticky', bottom: 16, display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
      <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid var(--gray-200)', borderRadius: 999, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)' }}>
        {lastDraftSavedTime && (
          <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>
            Tự động lưu: {lastDraftSavedTime}
          </span>
        )}
        <button className="btn btn-secondary" onClick={onSaveDraft} disabled={draftStatus === 'saving' || saving}>
          {draftStatus === 'saving' ? 'Đang lưu...' : 'Lưu nháp'}
        </button>
        <button className="btn btn-primary" onClick={onSubmit} disabled={saving || draftStatus === 'saving'} style={{ minWidth: 160 }}>
          <Send size={14} /> {saving ? 'Đang nộp...' : `Nộp bài (${answeredCount}/${totalQuestions})`}
        </button>
      </div>
    </div>
  );
}