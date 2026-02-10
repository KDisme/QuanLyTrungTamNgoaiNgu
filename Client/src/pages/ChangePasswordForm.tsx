import React, { useState } from "react";
import { Eye,
         EyeOff,
        Lock,
    CheckCircle, XCircle, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiChangePassword } from "../api/axios";

import "../styles/global.css";
import "../styles/form.css";
import "../styles/table.css";

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
    window.setTimeout(() => setNotification(null), 2500);
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
      await apiChangePassword({ currentPassword, newPassword });

      showNotification("success", "Đổi mật khẩu thành công, đang đăng xuất");
      window.setTimeout(() => {
        localStorage.removeItem("token");
        navigate("/");
      }, 1200);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Đổi mật khẩu thất bại";
      showNotification("error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {notification && (
        <div className={`toast ${notification.type === "success" ? "toast-success" : "toast-error"}`}>
          {notification.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-title">Đổi mật khẩu</h1>
          <p className="page-subtitle">Cập nhật mật khẩu tài khoản quản trị</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form className="form" onSubmit={handleSubmit}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="label">Mật khẩu hiện tại</label>
                <div className="input-wrap">
                 
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    className="input"
                    placeholder="Nhập mật khẩu hiện tại"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    aria-label="Toggle current password"
                  >
                    
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Mật khẩu mới</label>
                <div className="input-wrap">
                 
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className="input"
                    placeholder="Nhập mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label="Toggle new password"
                  >
                   
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Xác nhận mật khẩu mới</label>
              <div className="input-wrap">
               
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="input"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label="Toggle confirm password"
                >
                 
                </button>
              </div>
              <p className="hint">Đổi mật khẩu xong hệ thống sẽ đăng xuất và yêu cầu đăng nhập lại</p>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/dashboard")} disabled={loading}>
                Quay lại
              </button>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Save size={18} />
                {loading ? "Đang xử lý" : "Cập nhật"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordForm;
