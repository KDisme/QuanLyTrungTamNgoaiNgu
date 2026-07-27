import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, KeyRound } from 'lucide-react';

export default function PasswordGate({
  passwordInput,
  setPasswordInput,
  setPasswordError,
  passwordError,
  verifying,
  unlock,
}: {
  passwordInput: string;
  setPasswordInput: (v: string) => void;
  setPasswordError: (v: string) => void;
  passwordError: string;
  verifying: boolean;
  unlock: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}><ArrowLeft size={14} /> Quay lại</button>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--primary-light)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        <Lock color="var(--primary)" size={28} />
      </div>
      <h2 style={{ margin: '0 0 6px' }}>Bài tập yêu cầu mật khẩu</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: 20 }}>Nhập mật khẩu giáo viên đã cung cấp để bắt đầu làm bài.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="password"
          className="form-input"
          placeholder="Mật khẩu bài tập"
          value={passwordInput}
          onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
          autoFocus
        />
        <button className="btn btn-primary" onClick={unlock} disabled={verifying || !passwordInput.trim()}>
          <KeyRound size={14} /> {verifying ? 'Đang mở...' : 'Mở bài'}
        </button>
      </div>
      {passwordError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10, textAlign: 'left' }}>{passwordError}</div>}
    </div>
  );
}