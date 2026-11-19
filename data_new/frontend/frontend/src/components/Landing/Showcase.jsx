import { Link } from "react-router-dom";
import { photos } from "../../config/photos";
import Photo from "../ui/Photo";
import { Reveal } from "../ui/motion";

const roles = [
  { key: "driver", title: "EV Driver", sub: "Find a charger and book it.",
    items: ["Discover stations by distance", "Check charger compatibility", "Request and track reservations"] },
  { key: "operator", title: "Station Operator", sub: "Run your station with clarity.",
    items: ["View your assigned station", "Monitor charger occupancy", "Follow the waiting queue"] },
];

export default function Showcase() {
  return (
    <section id="platform" className="lp-sec lp-sec-tint">
      <div className="container">
        <Reveal className="lp-head">
          <span className="ev-badge">Platform</span>
          <h2>One platform, two dedicated experiences</h2>
          <p>Separate views for the people who charge and the people who run the stations.</p>
        </Reveal>
        <div className="lp-showcase">
          {roles.map((r, i) => (
            <Reveal key={r.key} delay={i * 0.12}>
              <Photo photo={photos[r.key]} ratio="5 / 4" overlay="bottom" className="lp-role">
                <div className="lp-role-body">
                  <h3>{r.title}</h3>
                  <p>{r.sub}</p>
                  <ul>{r.items.map((x) => <li key={x}><i className="bi bi-check-circle-fill" />{x}</li>)}</ul>
                  <Link to="/login" className="lp-btn lp-btn-light lp-btn-sm">Sign in <i className="bi bi-arrow-right" /></Link>
                </div>
              </Photo>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
