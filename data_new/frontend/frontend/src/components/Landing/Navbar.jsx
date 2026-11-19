import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";

const links = [
  ["About", "#about"],
  ["Features", "#features"],
  ["How It Works", "#how"],
  ["Platform", "#platform"],
  ["Network", "#network"],
];

export const Brand = ({ light = false }) => (
  <Link to="/" className={`ev-brand ${light ? "light" : ""}`} aria-label="EV Charge Network home">
    <span className="ev-logo"><i className="bi bi-lightning-charge-fill" /></span>
    <span>EV Charge<b>Network</b></span>
  </Link>
);

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header className={`lp-nav ${scrolled ? "scrolled" : ""}`}
      initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      <div className="container">
        <div className="lp-nav-bar">
          <Brand />
          <nav className="lp-nav-links" aria-label="Primary">
            {links.map(([t, h]) => <a key={t} href={h}>{t}</a>)}
          </nav>
          <div className="lp-nav-cta">
            <Link to="/login" className="lp-btn lp-btn-outline lp-btn-sm">Login</Link>
            <Link to="/register" className="lp-btn lp-btn-solid lp-btn-sm">Register</Link>
          </div>
          <button className="lp-burger" type="button" aria-label="Toggle navigation"
            aria-expanded={open} onClick={() => setOpen(!open)}>
            <i className={`bi ${open ? "bi-x-lg" : "bi-list"}`} />
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div className="lp-mobile" initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}>
              <nav aria-label="Mobile">
                {links.map(([t, h]) => <a key={t} href={h} onClick={() => setOpen(false)}>{t}</a>)}
                <div className="lp-mobile-cta">
                  <Link to="/login" className="lp-btn lp-btn-outline" onClick={() => setOpen(false)}>Login</Link>
                  <Link to="/register" className="lp-btn lp-btn-solid" onClick={() => setOpen(false)}>Register</Link>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
