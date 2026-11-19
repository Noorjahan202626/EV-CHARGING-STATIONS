import { Reveal, Stagger, StaggerItem } from "../ui/motion";

const features = [
  ["bi-cpu", "Smart Charging Allocation", "Chargers are assigned using vehicle category priority, connector compatibility and queue position."],
  ["bi-shield-lock", "Secure Reservations", "Role-based accounts and protected bookings keep every reservation tied to the right driver."],
  ["bi-broadcast", "Real-Time Station Availability", "See which chargers are free, reserved or in use before you set off."],
  ["bi-signpost-split", "Intelligent Distance Calculation", "Stations are ranked by distance from your location using stored station coordinates."],
  ["bi-arrow-repeat", "Transaction-Safe Booking", "Database transactions prevent two drivers from booking overlapping slots on the same charger."],
  ["bi-diagram-3", "Charging Network Management", "Operators monitor occupancy, queues and charging activity for the station they manage."],
];

export default function Features() {
  return (
    <section id="features" className="lp-sec lp-sec-tint">
      <div className="container">
        <Reveal className="lp-head">
          <span className="ev-badge">Features</span>
          <h2>Everything needed to coordinate charging</h2>
          <p>One integrated platform for discovery, reservation and station operations.</p>
        </Reveal>
        <Stagger className="lp-feature-grid">
          {features.map(([ic, t, d]) => (
            <StaggerItem key={t} className="lp-feature-wrap">
              <article className="ev-card hoverable lp-feature" tabIndex={0}>
                <span className="ev-icon"><i className={`bi ${ic}`} /></span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
