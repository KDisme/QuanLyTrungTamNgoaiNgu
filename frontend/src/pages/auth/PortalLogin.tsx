import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { authApi } from '../../api';
import toast from 'react-hot-toast';

export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await authApi.findTenant(email.trim());
      const { tenants } = res.data;
      if (tenants.length === 1) {
        navigate(`/${tenants[0].slug}/login`);
      } else {
        // Multiple tenants - show selection (rare case)
        navigate(`/portal/select`, { state: { tenants } });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không tìm thấy trung tâm với email này';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div className="login-card">
          <div className="login-logo">
            <Building2 size={26} />
          </div>
          <h2 style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            Đăng nhập
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 13, marginBottom: 24 }}>
            Nhập email để tìm trung tâm của bạn
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email <span className="required">*</span></label>
              <input
                className="form-input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 14 }}
            >
              {loading ? 'Đang tìm...' : <>Tiếp tục <ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{
            marginTop: 20, padding: 14, background: 'var(--gray-50)',
            borderRadius: 8, fontSize: 12.5, lineHeight: 1.8
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🧪 Tài khoản demo:</div>
            <div style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setEmail('demo@gmail.com')}>
              demo@gmail.com — Demo English Center
            </div>
            <div style={{ color: 'var(--gray-500)' }}>
              Mật khẩu: <strong>demo@123</strong>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--gray-500)' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Đăng ký trung tâm mới
            </Link>
          </div>

          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <Link to="/" style={{ color: 'var(--gray-400)', fontSize: 12.5, textDecoration: 'none' }}>
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
