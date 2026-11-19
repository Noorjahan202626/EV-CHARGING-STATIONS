import { Link } from "react-router-dom";
import { Brand } from "./Navbar";

export default function Footer() {
  return (
    <footer className="lp-footer">
      <div className="container lp-footer-grid">
        <div className="lp-f-brand">
          <Brand light />
          <p>A transaction-safe framework for real-time EV charging discovery, reservation and allocation.</p>
        </div>
        <div className="lp-f-col">
          <h6>Quick links</h6>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
        <div className="lp-f-col">
          <h6>Platform</h6>
          <span>Smart allocation</span>
          <span>Secure reservations</span>
          <span>Station availability</span>
          <span>Operator monitoring</span>
        </div>
        <div className="lp-f-col">
          <h6>Technology</h6>
          <span>React + Vite</span>
          <span>Node.js + Express</span>
          <span>PostgreSQL</span>
          <span>Motion + Bootstrap 5</span>
        </div>
      </div>
      <div className="container lp-f-copy">© 2026 EV Charge Network. All rights reserved.</div>
    </footer>
  );
}
