import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
// Chỉnh lại đường dẫn lùi ra 2 cấp để vào đúng thư mục api và styles
import api from "../../api/axios";
import "../../styles/form.css";

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await api.post("/auth/register", { name, email, password });
            alert(response.data.message || "Registration successful!");
            // Sau khi đăng ký thành công, điều hướng về trang Login (đường dẫn "/")
            navigate("/");
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || "Registration failed. Please try again.";
            alert(errorMessage);
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <div className="auth-head">
                    <h2 className="auth-title">Create Account</h2>
                    <p className="auth-desc">Fill information to create a new account</p>
                </div>

                <form className="form" onSubmit={handleSubmit}>
                    <div>
                        <label className="label">
                            Full Name <span className="req">*</span>
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">
                            Email <span className="req">*</span>
                        </label>
                        <input
                            type="email"
                            className="input"
                            placeholder="your.email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">
                            Password <span className="req">*</span>
                        </label>
                        <input
                            type="password"
                            className="input"
                            placeholder="Create password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary btn-block" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <span className="spinner" />
                                Creating...
                            </>
                        ) : (
                            "Sign Up"
                        )}
                    </button>

                    <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b", textAlign: "center" }}>
                        Already have an account?{" "}
                        <Link to="/" className="auth-link">
                            Login
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}