import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function SecurityTab({
  form,
  setForm,
  initial,
}: {
  form: any;
  setForm: (updater: (prev: any) => any) => void;
  initial?: any;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="toggle-row">
        <div className="toggle-row-text">
          <div className="toggle-row-title">Yêu cầu mật khẩu để làm bài</div>
          <div className="toggle-row-desc">
            {form.requirePassword
              ? 'Bật: học viên phải nhập đúng mật khẩu mới mở được đề bài (hữu ích khi thi tại lớp, tránh làm bài từ xa).'
              : 'Tắt: học viên mở bài tập bình thường, không cần mật khẩu.'}
          </div>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={!!form.requirePassword}
            onChange={(e) => setForm((prev: any) => ({ ...prev, requirePassword: e.target.checked }))}
          />
          <span className="toggle-track" />
        </label>
      </div>

      {form.requirePassword && (
        <div className="form-group">
          <label className="form-label">
            Mật khẩu bài tập {(initial?.require_password || initial?.requirePassword) ? '' : <span className="required">*</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              style={{ paddingRight: 40 }}
              value={form.password}
              onChange={(e) => setForm((prev: any) => ({ ...prev, password: e.target.value }))}
              placeholder={(initial?.require_password || initial?.requirePassword) ? 'Để trống nếu không muốn đổi mật khẩu' : 'Nhập mật khẩu học viên sẽ dùng'}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                display: 'flex', color: 'var(--gray-400)',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
            Đọc mật khẩu này cho học viên trước giờ làm bài. Giáo viên/Admin luôn xem được đề mà không cần mật khẩu.
          </div>
        </div>
      )}
    </div>
  );
}