import { motion } from "motion/react";
import MotionButton from "../ui/MotionButton";
import RealWorldEVVisual from "./RealWorldEVVisual";
import { EASE } from "../ui/easing";

const col = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } };
const rise = { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } };

export default function Hero() {
  return (
    <section id="home" className="lp-hero">
      <div className="container lp-hero-stack">
        <motion.div className="lp-hero-copy" variants={col} initial="hidden" animate="show">
          <motion.span variants={rise} className="ev-badge">
            <i className="bi bi-lightning-charge-fill" /> Smart EV charging network
          </motion.span>
          <motion.h1 variants={rise}>A smarter way to find, reserve and charge.</motion.h1>
          <motion.p variants={rise} className="lp-lead">
            Discover stations, check connector compatibility and book a charger with a transaction-safe
            reservation system built for EV drivers and station operators.
          </motion.p>
          <motion.div variants={rise} className="lp-hero-cta">
            <MotionButton to="/register" large>
              <i className="bi bi-geo-alt-fill" /> Find Charging Stations
            </MotionButton>
            <MotionButton href="#features" variant="outline" large>
              Explore Features
            </MotionButton>
          </motion.div>
          <motion.ul variants={rise} className="lp-points">
            {["Overlap-safe reservations", "Connector compatibility", "Operator monitoring"].map((p) => (
              <li key={p}>
                <i className="bi bi-check-circle-fill" />
                {p}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Photorealistic real-world electric SUV visual (video footage + genuine photography) */}
        <RealWorldEVVisual />
      </div>
    </section>
  );
}
