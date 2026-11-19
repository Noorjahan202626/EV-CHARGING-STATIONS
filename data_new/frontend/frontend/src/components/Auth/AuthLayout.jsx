import { Link } from "react-router-dom";
import { Brand } from "../Landing/Navbar";
import "../../styles/auth.css";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Brand light />
        <div>
          <h2>Smarter charging starts with a reliable reservation.</h2>
          <p>Discover stations, check compatibility and book a charger without overlaps.</p>
          <ul>
            {["Overlap-safe, transaction-based booking", "Distance-aware station discovery", "Dedicated driver and operator views"].map((t) => (
              <li key={t}><i className="bi bi-check-circle-fill" />{t}</li>
            ))}
          </ul>
        </div>
        <small style={{ opacity: .6, position: "relative", zIndex: 1 }}>© 2026 EV Charge Network</small>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="auth-back"><i className="bi bi-arrow-left" /> Back to home</Link>
          <h1>{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
          <p className="auth-foot">{footer}</p>
        </div>
      </main>
    </div>
  );
}
