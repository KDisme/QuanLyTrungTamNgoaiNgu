import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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

        if (!name.trim()) {
            alert("Name is required");
            return;
        }

        if (!email.trim()) {
            alert("Email is required");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters");
            return;
        }

        setIsLoading(true);

        try {

            const response = await api.post("/auth/register", {
                name: name.trim(),
                email: email.trim(),
                password
            });

            console.log("REGISTER SUCCESS:", response.data);

            alert(response.data.message || "Registration successful");

            navigate("/");

        } catch (error: any) {

            console.log("REGISTER ERROR FULL:", error.response?.data);

            const data = error.response?.data;

            if (data?.errors) {

                const firstError = Object.values(data.errors)[0];

                if (Array.isArray(firstError)) {
                    alert(firstError[0]);
                } else {
                    alert(firstError);
                }

            } else {

                alert(data?.message || "Registration failed");

            }

        } finally {

            setIsLoading(false);

        }
    };

    return (

        <div className="auth-wrap">

            <div className="auth-card">

                <div className="auth-head">
                    <h2 className="auth-title">Create Account</h2>
                    <p className="auth-desc">
                        Fill information to create a new account
                    </p>
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
                        />

                    </div>

                    <button
                        type="submit"
                        className="btn-primary btn-block"
                        disabled={isLoading}
                    >

                        {isLoading ? (
                            <>
                                <span className="spinner"></span>
                                Creating...
                            </>
                        ) : (
                            "Sign Up"
                        )}

                    </button>

                    <p
                        style={{
                            marginTop: 10,
                            fontSize: 13,
                            color: "#64748b",
                            textAlign: "center"
                        }}
                    >

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