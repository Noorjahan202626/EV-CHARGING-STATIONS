import { photos } from "../../config/photos";
import MotionButton from "../ui/MotionButton";
import { Reveal } from "../ui/motion";

export default function CTA() {
  return (
    <section className="lp-sec lp-cta-sec">
      <div className="container">
        <Reveal>
          <div className="lp-cta" style={{ backgroundImage: `url(${photos.cta.src})`, backgroundPosition: photos.cta.pos }}>
            <div className="lp-cta-tint" aria-hidden="true" />
            <div className="lp-cta-inner">
              <div>
                <h2>Ready to charge smarter?</h2>
                <p>Create an account to discover stations and reserve a charger.</p>
              </div>
              <div className="lp-cta-actions">
                <MotionButton to="/register" variant="light" large>Create account</MotionButton>
                <MotionButton to="/login" variant="ghost" large>Login</MotionButton>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
