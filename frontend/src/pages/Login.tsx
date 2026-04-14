import { useState, FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiLogin } from "../api/authService";
import "../styles/form.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const navigate = useNavigate();

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await apiLogin({ email, password });
      const token = res.data.token;

      localStorage.setItem("token", token);
      showNotification("success", "Login successful!");
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Login failed. Please check your credentials.";
      showNotification("error", msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      {notification && (
        <div className={`toast ${notification.type}`}>
          {notification.type === "success" ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="auth-card">
        <div className="auth-head">
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-desc">Sign in to continue to your account</p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div>
            <label className="label">
              Email  <span className="req">*</span>
            </label>
            <div className="input-wrap">
              <Mail size={18} className="icon-left" />
              <input
                type="email"
                className="input input-pad-left"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">
              Password <span className="req">*</span>
            </label>
            <div className="input-wrap">
              <Lock size={18} className="icon-left" />
              <input
                type={showPassword ? "text" : "password"}
                className="input input-pad-left input-pad-right"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="icon-right-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Toggle password"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-extra">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" />
              <span>Remember me</span>
            </label>

            <a className="auth-link" href="#">
              Forgot password?
            </a>
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {/* Registration is temporarily disabled on UI */}
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b", textAlign: "center" }}>
            Dang ky tai khoan tam thoi da duoc vo hieu hoa.
          </p>
        </form>
      </div>
    </div>
  );
}
