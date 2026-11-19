import { photos } from "../../config/photos";
import Photo from "../ui/Photo";
import { Reveal, Float } from "../ui/motion";

const points = [
  ["bi-calendar-check", "Reliable reservations", "Slots are booked inside database transactions so they can’t overlap."],
  ["bi-plug", "Compatible chargers", "Vehicle connector requirements are matched to available chargers."],
  ["bi-bar-chart-line", "Better utilisation", "Queues and reassignment keep chargers in use and waiting times short."],
];

export default function About() {
  return (
    <section id="about" className="lp-sec">
      <div className="container lp-about">
        <Reveal className="lp-about-photo">
          <Photo photo={photos.about} ratio="4 / 3" />
          <Float className="lp-float lp-about-card" delay={0.8}>
            <span className="ev-icon sm"><i className="bi bi-shield-check" /></span>
            <div><small>Booking</small><b>Transaction-safe</b></div>
          </Float>
        </Reveal>

        <div className="lp-about-text">
          <Reveal><span className="ev-badge">About the platform</span></Reveal>
          <Reveal delay={0.08}><h2>Charging that coordinates itself</h2></Reveal>
          <Reveal delay={0.16}>
            <p className="lp-muted">
              Charging today means uncertain availability, incompatible connectors and unpredictable waits.
              The EV Charging Station Network Orchestrator brings reservations, compatibility checks and
              charger allocation into one platform for drivers and operators.
            </p>
          </Reveal>
          <ul className="lp-points-list">
            {points.map(([ic, t, d], i) => (
              <Reveal key={t} delay={0.24 + i * 0.08}>
                <li><span className="ev-icon sm"><i className={`bi ${ic}`} /></span><div><b>{t}</b><span>{d}</span></div></li>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
