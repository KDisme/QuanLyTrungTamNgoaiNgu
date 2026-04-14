import React, { useState } from "react";
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Save, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiChangePassword } from "../api/authService";

import "../styles/global.css";
import "../styles/form.css";

const ChangePasswordForm: React.FC = () => {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    window.setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      showNotification("error", "Mật khẩu mới và xác nhận mật khẩu không khớp");
      return;
    }

    if (currentPassword === newPassword) {
      showNotification("error", "Mật khẩu mới phải khác mật khẩu hiện tại");
      return;
    }

    setLoading(true);
    try {
      await apiChangePassword({ oldPassword: currentPassword, newPassword });

      showNotification("success", "Đổi mật khẩu thành công, đang đăng xuất...");
      window.setTimeout(() => {
        localStorage.removeItem("token");
        navigate("/");
      }, 1500);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Đổi mật khẩu thất bại";
      showNotification("error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      {notification && (
        <div className={`toast ${notification.type === "success" ? "success" : "error"}`}>
          {notification.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="page-head" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <KeyRound size={28} color="var(--primary)" /> Đổi mật khẩu
          </h1>
          <p className="page-subtitle">Cập nhật mật khẩu tài khoản quản trị để bảo mật hơn</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        <form className="form" onSubmit={handleSubmit}>
          
          <div className="field">
            <label className="label">Mật khẩu hiện tại</label>
            <div className="input-wrap">
              <Lock className="icon-left" size={18} />
              <input
                type={showCurrentPassword ? "text" : "password"}
                className="input input-pad-left input-pad-right"
                placeholder="Nhập mật khẩu hiện tại"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="icon-right-btn"
                onClick={() => setShowCurrentPassword((v) => !v)}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="field">
            <label className="label">Mật khẩu mới</label>
            <div className="input-wrap">
              <Lock className="icon-left" size={18} />
              <input
                type={showNewPassword ? "text" : "password"}
                className="input input-pad-left input-pad-right"
                placeholder="Nhập mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="icon-right-btn"
                onClick={() => setShowNewPassword((v) => !v)}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="field">
            <label className="label">Xác nhận mật khẩu mới</label>
            <div className="input-wrap">
              <Lock className="icon-left" size={18} />
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="input input-pad-left input-pad-right"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="icon-right-btn"
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="help">Hệ thống sẽ đăng xuất và yêu cầu đăng nhập lại sau khi đổi mật khẩu.</p>
          </div>

          <div className="form-actions" style={{ marginTop: 24 }}>
            <button type="button" className="btn-outline" onClick={() => navigate("/dashboard")} disabled={loading}>
              Quay lại
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              <Save size={18} style={{ marginRight: 6 }} />
              {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ChangePasswordForm;
