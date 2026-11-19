import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/Auth/AuthLayout";
import Field from "../components/Auth/Field";
import { validateEmail } from "../utils/authValidation";

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "" });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const change = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: "" });
        if (apiError) setApiError("");
    };

    const submit = async (e) => {
        e.preventDefault();
        setApiError("");
        setSuccessMessage("");

        const err = {};
        const emailCheck = validateEmail(form.email);
        if (!emailCheck.valid) {
            err.email = emailCheck.error;
        }
        if (!form.password) err.password = "Password is required.";
        setErrors(err);
        if (Object.keys(err).length) return;

        setLoading(true);
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: emailCheck.normalized || form.email.trim().toLowerCase(),
                    password: form.password
                })
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                setApiError(data.error || "Login failed. Please check your credentials.");
                return;
            }

            // Save authenticated user info and JWT token
            const stored = { ...data.user, token: data.token };
            localStorage.setItem("user", JSON.stringify(stored));
    // Also store token separately for easy access
    localStorage.setItem("token", data.token);
            setSuccessMessage("Login successful! Redirecting to dashboard...");
            setTimeout(() => {
                navigate("/dashboard");
            }, 1200);
        } catch (err) {
            console.error("Login request error:", err);
            setApiError("Unable to connect to the backend server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Welcome back" subtitle="Sign in to manage reservations and charging."
            footer={<>New here? <Link to="/register">Create an account</Link></>}>
            <form className="auth-form" onSubmit={submit} noValidate>
                {apiError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 py-2" role="alert">
                        <i className="bi bi-exclamation-triangle-fill flex-shrink-0" />
                        <div>{apiError}</div>
                    </div>
                )}

                {successMessage && (
                    <div className="alert alert-success d-flex align-items-center gap-2 py-2" role="alert">
                        <i className="bi bi-check-circle-fill flex-shrink-0" />
                        <div>{successMessage}</div>
                    </div>
                )}

                <Field id="email" name="email" type="email" label="Email" autoComplete="email"
                    value={form.email} onChange={change} error={errors.email} placeholder="you@example.com"
                    disabled={loading} />
                <Field id="password" name="password" type="password" label="Password" autoComplete="current-password"
                    value={form.password} onChange={change} error={errors.password} placeholder="••••••••"
                    disabled={loading} />

                <button className="btn-ev btn-ev-lg" type="submit" disabled={loading}>
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                            Signing in...
                        </>
                    ) : (
                        "Sign in"
                    )}
                </button>
            </form>
        </AuthLayout>
    );
}
