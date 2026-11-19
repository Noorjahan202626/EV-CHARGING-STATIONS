import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/Auth/AuthLayout";
import Field from "../components/Auth/Field";
import { validateIndianVehicleNumber } from "../utils/vehicleValidation";
import { validateEmail } from "../utils/authValidation";

export default function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirm: "",
        registrationNo: "",
        vehicleType: ""
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState("");
    const [registeredUser, setRegisteredUser] = useState(null);

    // Password criteria helpers for validation & UI feedback
    const hasMinLen = form.password.length >= 8;
    const hasUpper = /[A-Z]/.test(form.password);
    const hasDigit = /[0-9]/.test(form.password);
    const hasSpecial = /[^A-Za-z0-9]/.test(form.password);

    const change = (e) => {
        const val = e.target.name === "registrationNo" ? e.target.value.toUpperCase() : e.target.value;
        setForm({
            ...form,
            [e.target.name]: val
        });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: "" });
        }
        if (apiError) setApiError("");
    };

    const handleEmailBlur = () => {
        if (!form.email.trim()) return;
        const check = validateEmail(form.email);
        if (!check.valid) {
            setErrors((prev) => ({ ...prev, email: check.error }));
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        setApiError("");

        const err = {};

        // Personal details validation
        if (!form.name.trim()) {
            err.name = "Name is required.";
        }

        const emailCheck = validateEmail(form.email);
        if (!emailCheck.valid) {
            err.email = emailCheck.error;
        }

        if (!form.password) {
            err.password = "Password is required.";
        } else if (!hasMinLen || !hasUpper || !hasDigit || !hasSpecial) {
            err.password = "Password must have min 8 characters, 1 capital letter, 1 digit, and 1 special character.";
        }

        if (form.confirm !== form.password) {
            err.confirm = "Passwords do not match.";
        }

        // Vehicle details validation (Indian RTO & BH series)
        const regCheck = validateIndianVehicleNumber(form.registrationNo);
        if (!regCheck.valid) {
            err.registrationNo = regCheck.error;
        }

        if (!form.vehicleType) {
            err.vehicleType = "Please select your vehicle type.";
        }

        setErrors(err);

        if (Object.keys(err).length > 0) return;

        // Connect to registration API
        setLoading(true);
        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: form.name.trim(),
                    email: emailCheck.normalized || form.email.trim().toLowerCase(),
                    password: form.password,
                    registrationNo: regCheck.normalized || form.registrationNo.trim().toUpperCase(),
                    vehicleType: form.vehicleType
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                const msg = data.error || "Registration failed. Please try again.";
                setApiError(msg);
                if (msg.toLowerCase().includes("email")) {
                    setErrors((prev) => ({ ...prev, email: msg }));
                }
                if (msg.toLowerCase().includes("vehicle") || msg.toLowerCase().includes("registration")) {
                    setErrors((prev) => ({ ...prev, registrationNo: msg }));
                }
                setLoading(false);
                return;
            }

            // Save registered details to display on screen
            setRegisteredUser({
                ...data.user,
                vehicle: data.vehicle,
                vehicleType: form.vehicleType
            });
        } catch (err) {
            console.error("Network or server error:", err);
            setApiError("Unable to connect to the server. Please check your backend is running.");
        } finally {
            setLoading(false);
        }
    };

    // If registered, show user card with "Go back to Home page" button
    if (registeredUser) {
        return (
            <AuthLayout
                title="Registration Successful!"
                subtitle="Your account and vehicle have been registered successfully."
                footer={
                    <>
                        Ready to sign in? <Link to="/login">Go to Login</Link>
                    </>
                }
            >
                <div
                    className="card border-0 shadow-sm rounded-4 p-4 mb-4"
                    style={{ background: "#f8fbfb", border: "1px solid #d8edeb" }}
                >
                    <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom">
                        <div
                            className="rounded-circle d-flex align-items-center justify-content-center"
                            style={{
                                width: 48,
                                height: 48,
                                background: "rgba(4, 120, 87, 0.12)",
                                color: "var(--ev-primary, #047857)"
                            }}
                        >
                            <i className="bi bi-person-check-fill fs-4" />
                        </div>
                        <div>
                            <h5 className="mb-0 fw-bold">{registeredUser.name}</h5>
                            <small className="text-muted">{registeredUser.email}</small>
                        </div>
                    </div>

                    <div className="row g-3 small">
                        <div className="col-6">
                            <span className="text-muted d-block">User ID</span>
                            <span className="fw-bold">#{registeredUser.user_id}</span>
                        </div>
                        <div className="col-6">
                            <span className="text-muted d-block">Role</span>
                            <span className="badge bg-success-subtle text-success fw-bold px-2 py-1">
                                {registeredUser.role || "USER"}
                            </span>
                        </div>
                        <div className="col-6">
                            <span className="text-muted d-block">Vehicle Number</span>
                            <span className="fw-bold">{registeredUser.vehicle?.registration_no}</span>
                        </div>
                        <div className="col-6">
                            <span className="text-muted d-block">Vehicle Category</span>
                            <span className="fw-bold">{registeredUser.vehicleType}</span>
                        </div>
                    </div>
                </div>

                <div className="d-grid gap-2">
                    <button
                        type="button"
                        className="btn-ev btn-ev-lg"
                        onClick={() => navigate("/")}
                    >
                        <i className="bi bi-house-door-fill me-2" />
                        Go back to Home page
                    </button>

                    <button
                        type="button"
                        className="btn-ev-outline btn-ev-lg"
                        onClick={() => navigate("/login")}
                    >
                        <i className="bi bi-box-arrow-in-right me-2" />
                        Proceed to Sign in
                    </button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Create your account"
            subtitle="Register to discover stations and reserve chargers."
            footer={
                <>
                    Already registered? <Link to="/login">Sign in</Link>
                </>
            }
        >
            <form className="auth-form" onSubmit={submit} noValidate>

                {/* API Feedback Alerts */}
                {apiError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 py-2" role="alert">
                        <i className="bi bi-exclamation-triangle-fill flex-shrink-0" />
                        <div>{apiError}</div>
                    </div>
                )}

                {/* PERSONAL DETAILS */}
                <h5 className="auth-section-title">Personal Details</h5>

                <Field
                    id="name"
                    name="name"
                    label="Full name"
                    autoComplete="name"
                    value={form.name}
                    onChange={change}
                    error={errors.name}
                    disabled={loading}
                />

                <Field
                    id="email"
                    name="email"
                    type="email"
                    label="Email"
                    autoComplete="email"
                    value={form.email}
                    onChange={change}
                    onBlur={handleEmailBlur}
                    error={errors.email}
                    placeholder="you@example.com"
                    disabled={loading}
                />

                <Field
                    id="password"
                    name="password"
                    type="password"
                    label="Password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={change}
                    error={errors.password}
                    disabled={loading}
                />

                {/* Password Criteria Checklist */}
                {form.password && (
                    <div className="mb-3 p-3 bg-light rounded-3 border">
                        <div className="fw-semibold text-muted mb-2" style={{ fontSize: "0.78rem" }}>
                            Password requirements:
                        </div>
                        <div className="d-flex flex-column gap-1" style={{ fontSize: "0.78rem" }}>
                            <span className={hasMinLen ? "text-success fw-medium" : "text-muted"}>
                                <i className={`bi ${hasMinLen ? "bi-check-circle-fill text-success" : "bi-circle text-secondary"} me-2`} />
                                At least 8 characters
                            </span>
                            <span className={hasUpper ? "text-success fw-medium" : "text-muted"}>
                                <i className={`bi ${hasUpper ? "bi-check-circle-fill text-success" : "bi-circle text-secondary"} me-2`} />
                                At least one capital letter (A–Z)
                            </span>
                            <span className={hasDigit ? "text-success fw-medium" : "text-muted"}>
                                <i className={`bi ${hasDigit ? "bi-check-circle-fill text-success" : "bi-circle text-secondary"} me-2`} />
                                At least one digit (0–9)
                            </span>
                            <span className={hasSpecial ? "text-success fw-medium" : "text-muted"}>
                                <i className={`bi ${hasSpecial ? "bi-check-circle-fill text-success" : "bi-circle text-secondary"} me-2`} />
                                At least one special character (!@#$%^&* etc.)
                            </span>
                        </div>
                    </div>
                )}

                <Field
                    id="confirm"
                    name="confirm"
                    type="password"
                    label="Confirm password"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={change}
                    error={errors.confirm}
                    disabled={loading}
                />

                {/* VEHICLE DETAILS */}
                <h5 className="auth-section-title">Vehicle Details</h5>

                <Field
                    id="registrationNo"
                    name="registrationNo"
                    label="Vehicle Registration Number"
                    placeholder="e.g. KA25AB1234 or 24BH1234AA"
                    value={form.registrationNo}
                    onChange={change}
                    error={errors.registrationNo}
                    disabled={loading}
                />

                <div className="auth-field">
                    <label htmlFor="vehicleType">
                        Vehicle Type
                    </label>

                    <select
                        id="vehicleType"
                        name="vehicleType"
                        className="form-select"
                        value={form.vehicleType}
                        onChange={change}
                        disabled={loading}
                    >
                        <option value="">Select vehicle type</option>
                        <option value="2W">2-Wheeler</option>
                        <option value="3W">3-Wheeler</option>
                        <option value="4W">4-Wheeler</option>
                    </select>

                    {errors.vehicleType && (
                        <small className="text-danger">
                            {errors.vehicleType}
                        </small>
                    )}
                </div>

                <button
                    className="btn-ev btn-ev-lg"
                    type="submit"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                            Creating account...
                        </>
                    ) : (
                        "Create account"
                    )}
                </button>

            </form>
        </AuthLayout>
    );
}
