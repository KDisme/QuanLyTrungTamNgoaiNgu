import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Eye, EyeOff, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { authApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

/** Slugify client-side để preview (phải khớp với logic server) */
function slugifyPreview(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const PAGE_STYLE = `
  .register-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 50%, #fef9c3 100%);
    padding: 24px 16px;
    font-family: var(--font, 'Inter', sans-serif);
  }
  .register-card {
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.10);
    padding: 40px 36px;
    width: 100%;
    max-width: 460px;
  }
  .register-logo {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, #6366f1, #0ea5e9);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 18px;
    color: white;
  }
  .register-title { text-align: center; font-size: 22px; font-weight: 800; margin-bottom: 4px; color: #1e293b; }
  .register-subtitle { text-align: center; color: #64748b; font-size: 13.5px; margin-bottom: 28px; }
  .slug-preview {
    margin-top: 8px;
    padding: 9px 13px;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 12.5px;
    color: #475569;
    display: flex; align-items: center; gap: 6px;
    min-height: 36px;
  }
  .slug-preview code { color: #4f46e5; font-weight: 600; font-size: 13px; }
  .password-wrap { position: relative; }
  .password-wrap input { padding-right: 40px; }
  .password-eye {
    position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #94a3b8; padding: 2px;
    display: flex; align-items: center;
  }
  .register-footer { text-align: center; margin-top: 20px; font-size: 13px; color: #64748b; }
  .register-footer a { color: #4f46e5; font-weight: 600; text-decoration: none; }
  .register-footer a:hover { text-decoration: underline; }
  .strength-bar { display: flex; gap: 4px; margin-top: 6px; }
  .strength-bar span { flex: 1; height: 3px; border-radius: 99px; transition: background .3s; }
  .success-screen { text-align: center; padding: 12px 0; }
  .success-screen .check-icon { color: #10b981; margin: 0 auto 16px; display: block; }
  .success-screen h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1e293b; }
  .success-screen p { color: #64748b; font-size: 13.5px; line-height: 1.7; }
  .success-url { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin: 14px 0; font-size: 13px; color: #166534; word-break: break-all; }
`;

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Yếu', color: '#ef4444' };
  if (score <= 3) return { score, label: 'Trung bình', color: '#f59e0b' };
  return { score, label: 'Mạnh', color: '#10b981' };
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const [form, setForm] = useState({ name: '', slug: '', email: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slugPreview, setSlugPreview] = useState('');
  const [slugLoading, setSlugLoading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [success, setSuccess] = useState<{ tenantSlug: string; tenantName: string } | null>(null);

  const debouncedSlug = useDebounce(form.slug, 400);

  // Check slug availability when slug changes
  useEffect(() => {
    if (!debouncedSlug) {
      setSlugPreview('');
      setSlugAvailable(null);
      return;
    }
    setSlugPreview(debouncedSlug);
    setSlugLoading(true);
    authApi.previewSlug(debouncedSlug)
      .then(res => {
        const available = res.data.slug === debouncedSlug;
        setSlugAvailable(available);
        setSlugPreview(res.data.slug || debouncedSlug);
      })
      .catch(() => {
        setSlugAvailable(true);
      })
      .finally(() => setSlugLoading(false));
  }, [debouncedSlug]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(f => ({
      ...f,
      name: val,
      slug: slugifyPreview(val)
    }));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Tự động chuyển thường, loại bỏ ký tự lạ, thay khoảng trắng thành dấu -
    const cleanSlug = val
      .toLowerCase()
      .replace(/đ/gi, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-');
    setForm(f => ({
      ...f,
      slug: cleanSlug
    }));
  };

  const handleSlugBlur = () => {
    setForm(f => ({
      ...f,
      slug: slugifyPreview(f.slug)
    }));
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const pwStrength = getPasswordStrength(form.password);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, slug, email, password, confirmPassword } = form;
    if (!name.trim() || !slug.trim() || !email.trim() || !password) {
      return toast.error('Vui lòng điền đầy đủ thông tin');
    }
    if (password !== confirmPassword) {
      return toast.error('Mật khẩu xác nhận không khớp');
    }
    if (password.length < 6) {
      return toast.error('Mật khẩu phải có ít nhất 6 ký tự');
    }

    setLoading(true);
    try {
      const res = await authApi.register(name.trim(), slug.trim(), email.trim().toLowerCase(), password);
      const { token, tenant, user } = res.data;

      // Lưu vào auth context để đăng nhập luôn
      authLogin(token, user, tenant.slug, tenant.name);

      setSuccess({ tenantSlug: tenant.slug, tenantName: tenant.name });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Đăng ký không thành công. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [form, authLogin]);

  // Tự động chuyển trang sau khi đăng ký thành công
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => {
      navigate(`/${success.tenantSlug}/admin/dashboard`, { replace: true });
    }, 3000);
    return () => clearTimeout(t);
  }, [success, navigate]);

  return (
    <div className="register-page">
      <style>{PAGE_STYLE}</style>
      <div className="register-card">
        <div className="register-logo">
          <Building2 size={26} />
        </div>

        {success ? (
          <div className="success-screen">
            <CheckCircle2 size={56} className="check-icon" />
            <h3>Đăng ký thành công! 🎉</h3>
            <p>Trung tâm <strong>{success.tenantName}</strong> đã được tạo.<br />Bạn sẽ được chuyển đến trang quản lý trong giây lát...</p>
            <div className="success-url">
              🔗 Đường dẫn đăng nhập của bạn:<br />
              <strong>/{success.tenantSlug}/login</strong>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => navigate(`/${success.tenantSlug}/admin/dashboard`, { replace: true })}
            >
              Vào trang quản lý ngay <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <>
            <h2 className="register-title">Đăng ký trung tâm mới</h2>
            <p className="register-subtitle">Tạo tài khoản để quản lý trung tâm tiếng Anh của bạn</p>

            <form onSubmit={handleSubmit} noValidate>
              {/* Tên trung tâm */}
              <div className="form-group">
                <label className="form-label">
                  Tên trung tâm <span className="required">*</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="VD: ABC English Center"
                  value={form.name}
                  onChange={handleNameChange}
                  autoFocus
                  maxLength={200}
                />
              </div>

              {/* Đường dẫn (Slug) */}
              <div className="form-group">
                <label className="form-label">
                  Đường dẫn đăng nhập (slug) <span className="required">*</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="VD: abc-english"
                  value={form.slug}
                  onChange={handleSlugChange}
                  onBlur={handleSlugBlur}
                  maxLength={100}
                />
                {form.slug.trim() && (
                  <div className="slug-preview">
                    {slugLoading ? (
                      <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang kiểm tra...</>
                    ) : slugAvailable === false ? (
                      <span style={{ color: '#ef4444' }}>❌ Đường dẫn này đã tồn tại, hãy dùng: <code>{slugPreview}</code></span>
                    ) : (
                      <>🔗 Link đăng nhập: <code>/{slugPreview}/login</code></>
                    )}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label">
                  Email quản trị <span className="required">*</span>
                </label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="admin@trungtam.vn"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                />
              </div>

              {/* Mật khẩu */}
              <div className="form-group">
                <label className="form-label">
                  Mật khẩu <span className="required">*</span>
                </label>
                <div className="password-wrap">
                  <input
                    className="form-input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Tối thiểu 6 ký tự"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                  />
                  <button type="button" className="password-eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.password && (
                  <>
                    <div className="strength-bar">
                      {[1, 2, 3, 4, 5].map(i => (
                        <span key={i} style={{ background: i <= pwStrength.score ? pwStrength.color : '#e2e8f0' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11.5, color: pwStrength.color, marginTop: 3 }}>
                      Độ mạnh: {pwStrength.label}
                    </div>
                  </>
                )}
              </div>

              {/* Xác nhận mật khẩu */}
              <div className="form-group">
                <label className="form-label">
                  Xác nhận mật khẩu <span className="required">*</span>
                </label>
                <div className="password-wrap">
                  <input
                    className="form-input"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    autoComplete="new-password"
                    style={{
                      borderColor: form.confirmPassword
                        ? form.confirmPassword === form.password ? '#10b981' : '#ef4444'
                        : undefined,
                    }}
                  />
                  <button type="button" className="password-eye" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Mật khẩu không khớp</div>
                )}
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 4 }}
              >
                {loading
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Đang tạo tài khoản...</>
                  : <>Đăng ký ngay <ArrowRight size={15} /></>
                }
              </button>
            </form>

            <div className="register-footer">
              Đã có tài khoản?{' '}
              <Link to="/">Đăng nhập</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
