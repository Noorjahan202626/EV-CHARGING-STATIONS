import { photos } from "../../config/photos";
import useCountUp from "../../hooks/useCountUp";
import useNetworkStats from "../../hooks/useNetworkStats";
import { Reveal, Stagger, StaggerItem } from "../ui/motion";

/* Real data only:
   - Stations: live from GET /api/health (database count).
   - Others:   counts from the dataset in EV_Charging_Database/data/*.csv.  */
const datasetStats = [
  ["bi-lightning-charge", 8501, "Chargers in dataset"],
  ["bi-building", 30, "Charging networks"],
  ["bi-plug", 7, "Connector types"],
  ["bi-pin-map", 415, "Towns covered"],
];

function Counter({ value, loading, error }) {
  const [ref, n] = useCountUp(value);
  return (
    <span ref={ref} className="lp-stat-value">
      {loading ? <span className="ev-skeleton">0000</span> : error ? "—" : n.toLocaleString("en-IN")}
    </span>
  );
}

export default function Stats() {
  const { status, stations } = useNetworkStats();
  return (
    <section id="network" className="lp-stats" style={{ backgroundImage: `url(${photos.stats.src})` }}>
      <div className="lp-stats-tint" aria-hidden="true" />
      <div className="container lp-stats-inner">
        <Reveal className="lp-head light">
          <span className="ev-badge">Network</span>
          <h2>Built on a real charging dataset</h2>
          <p>Figures come from the project database and its imported dataset.</p>
        </Reveal>
        <Stagger className="lp-stats-grid">
          <StaggerItem className="lp-stat">
            <span className="ev-icon on-dark"><i className="bi bi-geo-alt-fill" /></span>
            <Counter value={stations} loading={status === "loading"} error={status === "error"} />
            <span className="lp-stat-label">Stations (live from database)</span>
            {status === "error" && <small className="lp-stat-note">Backend not reachable</small>}
          </StaggerItem>
          {datasetStats.map(([ic, v, l]) => (
            <StaggerItem key={l} className="lp-stat">
              <span className="ev-icon on-dark"><i className={`bi ${ic}`} /></span>
              <Counter value={v} />
              <span className="lp-stat-label">{l}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
