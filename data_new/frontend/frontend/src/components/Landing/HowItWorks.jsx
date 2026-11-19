import { photos } from "../../config/photos";
import Photo from "../ui/Photo";
import { Reveal, Stagger, StaggerItem } from "../ui/motion";

const steps = [
  ["bi-person-plus", "Register", "Create your account to access the platform."],
  ["bi-search", "Discover stations", "Explore nearby stations and compatible chargers."],
  ["bi-calendar-check", "Reserve a charger", "Pick a charger and request a time slot."],
  ["bi-ev-front", "Start charging", "Check in at the station and begin your session."],
];

export default function HowItWorks() {
  return (
    <section id="how" className="lp-sec">
      <div className="container lp-how">
        <Reveal className="lp-how-photo">
          <Photo photo={photos.how} ratio="5 / 4" overlay="bottom">
            <span className="lp-photo-caption">From sign-up to plugged in</span>
          </Photo>
        </Reveal>

        <div>
          <Reveal className="lp-head left">
            <span className="ev-badge">How it works</span>
            <h2>Four steps from sign-up to charging</h2>
          </Reveal>
          <Stagger className="lp-steps">
            {steps.map(([ic, t, d], i) => (
              <StaggerItem key={t} className="lp-step">
                <span className="lp-step-node"><i className={`bi ${ic}`} /></span>
                <div>
                  <small>Step {i + 1}</small>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
