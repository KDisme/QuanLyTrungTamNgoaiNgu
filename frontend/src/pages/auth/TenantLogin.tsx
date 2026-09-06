import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { getRoleHome } from '../../config/roleConfig';
import toast from 'react-hot-toast';

export default function TenantLogin() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [identifier, setIdentifier] = useState(tenantSlug === 'demo' ? 'demo@gmail.com' : '');
  const [password, setPassword] = useState(tenantSlug === 'demo' ? 'demo@123' : '');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Try to get tenant name from previous steps
  const tenantName = localStorage.getItem('tenantName') || tenantSlug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true);
    try {
      const res = await authApi.login(tenantSlug!, identifier, password);
      const { token, user } = res.data;
      // Get tenant name from API response or use slug
      const tName = tenantName || tenantSlug!;
      login(token, user, tenantSlug!, tName);
      toast.success(`Chào mừng, ${user.fullName}!`);
      navigate(getRoleHome(tenantSlug!, user.roles));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="login-card">
          <div className="login-logo" style={{ background: '#2563eb' }}>
            <GraduationCap size={26} />
          </div>
          <h2 style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
            {tenantName || 'Trung Tâm'}
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 13, marginBottom: 24 }}>
            Đăng nhập để tiếp tục
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email hoặc số điện thoại <span className="required">*</span></label>
              <input
                className="form-input"
                placeholder="Email hoặc SĐT"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu <span className="required">*</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 14, marginTop: 4 }}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>


          <div style={{ marginTop: 20, padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 12, lineHeight: 1.7 }}>
            <strong>Tài khoản demo:</strong> demo@gmail.com / demo@123
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setIdentifier('demo@gmail.com'); setPassword('demo@123'); }}
              style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: 12, marginTop: 8 }}
            >
              Điền tài khoản demo
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#64748b' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
              Đăng ký trung tâm mới
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
