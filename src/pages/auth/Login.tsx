import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import "../../styles/form.css";

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

            const res = await api.post("/auth/login", {
                email,
                password
            });

            console.log("LOGIN RESPONSE:", res.data);

            const token = res.data.token || res.data.data?.token;

            if (!token) {
                throw new Error("Token not returned from server");
            }

            localStorage.setItem("token", token);

            showNotification("success", "Login successful");

            setTimeout(() => {
                navigate("/dashboard");
            }, 800);

        } catch (error: any) {

            console.error("LOGIN ERROR:", error);

            const msg =
                error.response?.data?.message ||
                error.response?.data?.error ||
                "Login failed";

            showNotification("error", msg);
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-wrap">

            {notification && (
                <div className={`toast ${notification.type}`}>
                    {notification.type === "success"
                        ? <CheckCircle size={20} />
                        : <XCircle size={20} />}
                    <span>{notification.message}</span>
                </div>
            )}

            <div className="auth-card">

                <div className="auth-head">
                    <h2 className="auth-title">Welcome Back</h2>
                    <p className="auth-desc">Sign in to continue</p>
                </div>

                <form className="form" onSubmit={handleSubmit}>

                    {/* EMAIL */}
                    <div>
                        <label className="label">
                            Email <span className="req">*</span>
                        </label>

                        <div className="input-wrap">
                            <Mail size={18} className="icon-left" />

                            <input
                                type="email"
                                className="input input-pad-left"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* PASSWORD */}
                    <div>
                        <label className="label">
                            Password <span className="req">*</span>
                        </label>

                        <div className="input-wrap">
                            <Lock size={18} className="icon-left" />

                            <input
                                type={showPassword ? "text" : "password"}
                                className="input input-pad-left input-pad-right"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            <button
                                type="button"
                                className="icon-right-btn"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* BUTTON */}
                    <button
                        type="submit"
                        className="btn-primary btn-block"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className="spinner"></span>
                                Signing in...
                            </>
                        ) : (
                            <>
                                Sign In
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    <p style={{ textAlign: "center", marginTop: 10 }}>
                        Don't have an account?
                        <Link to="/register" className="auth-link">
                            Create account
                        </Link>
                    </p>

                </form>
            </div>
        </div>
    );
}