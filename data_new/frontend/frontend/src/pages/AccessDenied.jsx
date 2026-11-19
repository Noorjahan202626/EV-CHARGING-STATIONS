import { Link } from "react-router-dom";

export default function AccessDenied() {
    return (
        <div className="auth-main" style={{ minHeight: "100vh" }}>
            <div className="ev-card ev-empty" style={{ maxWidth: 440, padding: "3rem 2rem" }}>
                <i className="bi bi-shield-lock" />
                <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Access denied</h1>
                <p>You don’t have permission to view this page.</p>
                <Link to="/" className="btn-ev">Back to home</Link>
            </div>
        </div>
    );
}
