// src/components/Map/NearbyDistance.jsx
import React, { useEffect, useMemo, useState } from "react";
import { haversineKm, fmtDistance } from "./mapUtils";

/**
 * Props
 *  - stations: array of station objects coming from /api/stations
 *  - userLocation: [lat, lng]
 *  - radiusKm: number – maximum radius the user wants to see
 */

// Set to false once everything works
const DEBUG = true;
const PAGE_SIZE = 50;

// Try every common field name and return [lat, lng] or null if invalid
function getStationPosition(s) {
  let lat = Number(
    s.latitude ?? s.lat ?? s.position?.[0] ?? s.location?.lat ?? s.location?.latitude
  );
  let lng = Number(
    s.longitude ?? s.lng ?? s.lon ?? s.position?.[1] ?? s.location?.lng ?? s.location?.longitude
  );

  // If those did not yield valid numbers, fall back to a GeoJSON-style coordinates array [lng, lat]
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const coords = s.coordinates ?? s.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      lng = Number(coords[0]);
      lat = Number(coords[1]);
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return [lat, lng];
}

// Accept [lat, lng] or { lat, lng } / { latitude, longitude }
function normalizeLocation(loc) {
  if (!loc) return null;
  if (Array.isArray(loc)) {
    const lat = Number(loc[0]);
    const lng = Number(loc[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  const lat = Number(loc.lat ?? loc.latitude);
  const lng = Number(loc.lng ?? loc.lon ?? loc.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

export default function NearbyDistance({ stations, userLocation, radiusKm }) {
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

  // Reset pagination when radius or stations list changes
  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [radiusKm, stations]);

  // -----------------------------------------------------------------
  // Compute the filtered list + distance (memoised)
  // -----------------------------------------------------------------
  const nearby = useMemo(() => {
    const origin = normalizeLocation(userLocation);
    const radius = Number(radiusKm);

    if (!Array.isArray(stations) || !stations.length || !origin) {
      if (DEBUG) console.warn("Skipping: missing stations or invalid userLocation", { stations, origin });
      return [];
    }

    const all = stations.map((s) => {
      const pos = getStationPosition(s);
      const dist = pos ? haversineKm(origin, pos) : NaN;
      return { ...s, _pos: pos, _distKm: dist };
    });

    return all
      .filter((s) => s._pos && s._distKm <= radius) // valid coords + inside radius
      .sort((a, b) => a._distKm - b._distKm); // nearest first
  }, [stations, userLocation, radiusKm]);

  // Track co-located stations sharing coordinates
  const { uniqueLocationsCount, coLocatedKeys } = useMemo(() => {
    const locCounts = new Map();
    for (const st of nearby) {
      if (st._pos) {
        const key = `${st._pos[0].toFixed(6)}_${st._pos[1].toFixed(6)}`;
        locCounts.set(key, (locCounts.get(key) || 0) + 1);
      }
    }
    const sharedKeys = new Set();
    for (const [key, count] of locCounts.entries()) {
      if (count > 1) sharedKeys.add(key);
    }
    return {
      uniqueLocationsCount: locCounts.size,
      coLocatedKeys: sharedKeys,
    };
  }, [nearby]);

  const hasSharedLocations = uniqueLocationsCount < nearby.length;
  const visibleStations = nearby.slice(0, displayLimit);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <div className="card shadow-sm border-0 mt-3" style={{ borderRadius: "10px", overflow: "hidden" }}>
      <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "1.05rem" }}>
          Nearby Stations within {fmtDistance(Number(radiusKm) || 0)}
          <span className="text-muted fw-normal ms-2 small">
            ({normalizeLocation(userLocation) ? `${nearby.length} total` : "Waiting for location..."})
          </span>
        </h5>
        {nearby.length > displayLimit && (
          <span className="badge bg-secondary">
            Showing top {visibleStations.length} of {nearby.length}
          </span>
        )}
      </div>

      {hasSharedLocations && (
        <div className="alert alert-info py-2 px-3 m-3 mb-0 small d-flex align-items-center gap-2">
          <span>
            ℹ️ <strong>Marker sync notice:</strong> {nearby.length} stations found across{" "}
            <strong>{uniqueLocationsCount} distinct physical locations</strong>. Stations sharing the same address/coordinates have distinct markers placed side-by-side on the map.
          </span>
        </div>
      )}

      <ul className="list-group list-group-flush">
        {!normalizeLocation(userLocation) ? (
          <li className="list-group-item text-muted py-4 text-center">
            <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
            Waiting for your location... Please enable location permissions in your browser.
          </li>
        ) : nearby.length === 0 ? (
          <li className="list-group-item text-muted py-4 text-center">
            No stations found within {fmtDistance(Number(radiusKm) || 0)}. Try increasing your search distance.
          </li>
        ) : (
          visibleStations.map((st, i) => {
          const isCoLocated =
            st._pos && coLocatedKeys.has(`${st._pos[0].toFixed(6)}_${st._pos[1].toFixed(6)}`);
          const price = st.price ?? st.tariff_per_kwh ?? "N/A";
          return (
            <li
              key={st.id ?? `${st.name}-${i}`}
              className="list-group-item d-flex justify-content-between align-items-start py-3"
            >
              <div>
                <div className="d-flex align-items-center flex-wrap gap-1">
                  <strong className="text-dark">{st.name}</strong>
                  {isCoLocated && (
                    <span className="badge bg-light text-secondary border small">
                      Shared site
                    </span>
                  )}
                  {st.status && (
                    <span
                      className={`badge small ms-1 ${
                        String(st.status).toUpperCase() === "OPERATIONAL" || String(st.status).toUpperCase() === "AVAILABLE"
                          ? "bg-success"
                          : "bg-warning text-dark"
                      }`}
                      style={{ fontSize: "0.75rem" }}
                    >
                      {st.status}
                    </span>
                  )}
                </div>
                <small className="text-muted d-block mt-1">{st.address}</small>
                <div className="text-muted small mt-1 d-flex gap-3 flex-wrap">
                  <span>
                    <strong>Tariff:</strong> {price !== "N/A" ? `₹${price}/kWh` : "N/A"}
                  </span>
                  <span>
                    <strong>Chargers:</strong> {st.availableChargers ?? 0} / {st.totalChargers ?? 0} free
                  </span>
                </div>
              </div>
              <span className="badge bg-primary rounded-pill px-3 py-2">
                {fmtDistance(st._distKm)}
              </span>
            </li>
          );
        })
      )}
      </ul>

      {nearby.length > displayLimit && (
        <div className="p-3 text-center bg-light border-top">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary px-4"
            onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
          >
            Show more ({nearby.length - displayLimit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
