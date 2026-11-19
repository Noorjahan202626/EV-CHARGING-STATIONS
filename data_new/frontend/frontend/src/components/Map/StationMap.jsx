// src/components/Map/StationMap.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [12.9716, 77.5946]; // fallback until GPS locks in
const DEFAULT_RADIUS = 5;
const PRESET_DISTANCES = [2, 5, 10];
const MAX_MARKERS = 500;
const MIN_RADIUS = 0.5;
const MAX_RADIUS = 100;

// ---------- Helper components ----------

// Fixes grey tile bug on container resize
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Zooms so the whole search circle is visible when location or radius changes.
// Depends on lat/lng numbers, not the array, so it doesn't re-fire on every render.
function MapFitRadius({ lat, lng, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(lat, lng).toBounds(radiusKm * 2000);
    map.flyToBounds(bounds, { padding: [20, 20], duration: 1 });
  }, [lat, lng, radiusKm, map]);
  return null;
}

// ---------- Icons ----------

const createPinSvg = (fillColor) => `
  <svg width="28" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.3));">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${fillColor}" />
    <circle cx="12" cy="12" r="4.5" fill="white" />
  </svg>
`;

const userLocationIcon = L.divIcon({
  className: "custom-user-pin",
  html: `<div style="width:20px;height:20px;background-color:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(37,99,235,0.7);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const GREEN = "#10b981";
const ORANGE = "#f97316";
const RED = "#ef4444";

const getStationColor = (s) => {
  const status = String(s.status || "").toUpperCase();
  if (["OFFLINE", "INACTIVE", "UNDER_MAINTENANCE", "UNDER MAINTENANCE"].includes(status)) return RED;

  const total = Number(s.totalChargers);
  const avail = Number(s.availableChargers);
  if (Number.isFinite(total) && Number.isFinite(avail) && total > 0) {
    if (avail <= 0) return RED;
    if (avail < total) return ORANGE;
    return GREEN;
  }
  if (["FULL", "OCCUPIED"].includes(status)) return RED;
  if (["PARTIAL", "PARTIALLY_AVAILABLE", "BUSY"].includes(status)) return ORANGE;
  return GREEN;
};

const iconCache = {};
const getStationIcon = (color) => {
  if (!iconCache[color]) {
    iconCache[color] = L.divIcon({
      className: "custom-station-pin",
      html: createPinSvg(color),
      iconSize: [28, 40],
      iconAnchor: [14, 40],
      popupAnchor: [0, -38],
    });
  }
  return iconCache[color];
};

// ---------- Data helpers ----------

// Supports: position:[lat,lng], {latitude,longitude}, {lat,lng}, GeoJSON [lng,lat]
const getPosition = (s) => {
  let lat = s.latitude ?? s.lat;
  let lng = s.longitude ?? s.lng ?? s.lon;

  if ((lat == null || lng == null) && Array.isArray(s.position) && s.position.length >= 2) {
    lat = s.position[0];
    lng = s.position[1];
  }

  if (lat == null || lng == null) {
    const coords = s.location?.coordinates || s.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      lng = coords[0];
      lat = coords[1];
    }
  }

  lat = parseFloat(lat);
  lng = parseFloat(lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [lat, lng];
};

// Accepts [lat, lng] or { lat, lng } / { latitude, longitude }; returns [lat, lng] or null
const normalizeLocation = (loc) => {
  if (!loc) return null;
  const lat = Number(Array.isArray(loc) ? loc[0] : loc.lat ?? loc.latitude);
  const lng = Number(Array.isArray(loc) ? loc[1] : loc.lng ?? loc.lon ?? loc.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

const haversineKm = ([lat1, lon1], [lat2, lon2]) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const formatDistance = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);

const normalizeConnectors = (list) =>
  (Array.isArray(list) ? list : [])
    .map((c) => (typeof c === "string" ? c : c?.type || c?.code || c?.name || ""))
    .map((c) => String(c).toUpperCase())
    .filter(Boolean);

const BAD_STATUSES = ["FULL", "OCCUPIED", "OFFLINE"];

// ---------- Main component ----------
/**
 * Props (all optional, so the component also works standalone)
 *  - filter:           connector / current / availability filter object
 *  - stationsData:     stations array from the parent. If omitted (undefined/null),
 *                      the map fetches /api/stations itself.
 *  - userLocation:     [lat, lng] from the parent. If omitted, the map uses GPS itself.
 *  - radiusKm:         radius from the parent. If omitted, the map keeps its own.
 *  - onRadiusChange:   called with the new radius when the user changes it here.
 */
export default function StationMap({
  filter,
  stationsData,
  userLocation: externalUserLocation,
  radiusKm: externalRadius,
  onRadiusChange,
}) {
  // ----- stations -----
  const [fetchedStations, setFetchedStations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Parent controls stations when it passes an array (even an empty one).
  const parentControlsStations = Array.isArray(stationsData);
  const stations = parentControlsStations ? stationsData : fetchedStations;

  // ----- location -----
  const [gpsLocation, setGpsLocation] = useState(null);
  const parentLocation = normalizeLocation(externalUserLocation);
  const userLocation = parentLocation ?? gpsLocation ?? DEFAULT_CENTER;

  // ----- radius -----
  const [internalRadius, setInternalRadius] = useState(DEFAULT_RADIUS);
  const parentControlsRadius = Number.isFinite(Number(externalRadius)) && externalRadius !== null;
  const radiusKm = parentControlsRadius ? Number(externalRadius) : internalRadius;
  const [radiusInput, setRadiusInput] = useState(String(radiusKm));

  const [selectedId, setSelectedId] = useState(null);

  const commitRadius = (v) => {
    if (!parentControlsRadius) setInternalRadius(v);
    onRadiusChange?.(v);
  };

  // Keep the text box in sync when the parent changes the radius
  useEffect(() => {
    setRadiusInput(String(radiusKm));
  }, [radiusKm]);

  // 1. GPS: only when the parent doesn't provide a location
  useEffect(() => {
    if (parentLocation || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setGpsLocation([p.coords.latitude, p.coords.longitude]),
      (err) => console.warn("Location denied or failed, using default center.", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!parentLocation]);

  // 2. Fetch stations: only when the parent doesn't pass an array
  useEffect(() => {
    if (parentControlsStations) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const token =
      JSON.parse(localStorage.getItem("user") || "{}").token || localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    fetch("/api/stations", { headers, signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.stations || data.data || null;
        if (list) {
          setFetchedStations(list);
          setError(null);
        } else {
          setError(data.error || "Failed to load stations");
        }
      })
      .catch((e) => {
        if (e.name === "AbortError" && !timedOut) return; // unmounted, ignore
        console.error("Fetch error:", e);
        setError(
          timedOut
            ? "Backend timed out. Is the server running?"
            : `Could not load stations (${e.message}).`
        );
      })
      .finally(() => {
        clearTimeout(timer);
        if (!controller.signal.aborted || timedOut) setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [parentControlsStations]);

  // Commit the typed distance after a short pause (valid values only)
  useEffect(() => {
    const t = setTimeout(() => {
      const v = parseFloat(radiusInput);
      if (!Number.isNaN(v) && v >= MIN_RADIUS && v <= MAX_RADIUS && v !== radiusKm) {
        commitRadius(v);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusInput]);

  const applyPreset = (d) => {
    commitRadius(d);
    setRadiusInput(String(d));
  };

  const handleRadiusBlur = () => {
    const v = parseFloat(radiusInput);
    if (Number.isNaN(v) || v < MIN_RADIUS || v > MAX_RADIUS) {
      setRadiusInput(String(radiusKm));
    } else {
      commitRadius(v);
      setRadiusInput(String(v));
    }
  };

  // 3. Filter by compatibility + distance, attach distance, sort nearest first
  const [userLat, userLng] = userLocation;
  const { nearby, totalWithin } = useMemo(() => {
    const origin = [userLat, userLng];
    const hasFilter = !!filter && typeof filter === "object";

    const wanted = hasFilter
      ? normalizeConnectors(filter.connectorTypes || filter.connectors || filter.connectorCodes)
      : [];
    const currentType = hasFilter ? filter.currentType || filter.current : null;
    const availableOnly = hasFilter
      ? !!(filter.availableNow || filter.availableOnly || filter.onlyAvailable || filter.available)
      : false;

    const result = [];
    for (const s of stations) {
      const pos = getPosition(s);
      if (!pos) continue;

      const dist = haversineKm(origin, pos);
      if (dist > radiusKm) continue;

      if (hasFilter) {
        if (wanted.length > 0) {
          const have = normalizeConnectors(s.connectorTypes || s.connectors);
          if (!have.some((c) => wanted.includes(c))) continue;
        }
        if (currentType && String(currentType).toUpperCase() !== "ALL" && s.currentType) {
          if (String(s.currentType).toUpperCase() !== String(currentType).toUpperCase()) continue;
        }
        if (availableOnly) {
          if (typeof s.availableChargers === "number" && s.availableChargers <= 0) continue;
          if (BAD_STATUSES.includes(String(s.status || "").toUpperCase())) continue;
        }
      }

      result.push({ ...s, _pos: pos, _distKm: dist });
    }

    result.sort((a, b) => a._distKm - b._distKm);
    return { nearby: result.slice(0, MAX_MARKERS), totalWithin: result.length };
  }, [stations, filter, userLat, userLng, radiusKm]);

  const selected = nearby.find((s, i) => (s.id ?? s._id ?? i) === selectedId) || null;

  if (error) {
    return <div className="alert alert-danger m-3">Error loading stations: {error}</div>;
  }

  return (
    <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "10px", overflow: "hidden" }}>
      <div className="card-header bg-white py-3 border-bottom">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "1.1rem" }}>
            Interactive Map (OpenStreetMap)
          </h5>
          <span className="text-muted small">
            {totalWithin} stations within {radiusKm} km
            {totalWithin > MAX_MARKERS && ` (showing nearest ${MAX_MARKERS})`}
          </span>
        </div>

        <div className="d-flex align-items-center flex-wrap gap-2 mt-3">
          <span className="small fw-semibold">How far can you travel?</span>
          <div className="btn-group btn-group-sm" role="group">
            {PRESET_DISTANCES.map((d) => (
              <button
                key={d}
                type="button"
                className={`btn ${radiusKm === d ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => applyPreset(d)}
              >
                {d} km
              </button>
            ))}
          </div>
          <div className="d-flex align-items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step="0.5"
              value={radiusInput}
              onChange={(e) => setRadiusInput(e.target.value)}
              onBlur={handleRadiusBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="form-control form-control-sm"
              style={{ width: "85px" }}
              aria-label="Custom distance in km"
            />
            <span className="small text-muted">km</span>
          </div>
          {selected && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary ms-auto"
              onClick={() => setSelectedId(null)}
            >
              Clear line
            </button>
          )}
        </div>
      </div>

      <div style={{ height: "500px", width: "100%", position: "relative" }}>
        {loading && (
          <div
            className="position-absolute top-50 start-50 translate-middle bg-white p-3 rounded shadow"
            style={{ zIndex: 1000 }}
          >
            Loading stations...
          </div>
        )}

        <MapContainer center={userLocation} zoom={11} style={{ height: "100%", width: "100%" }}>
          <MapResizer />
          <MapFitRadius lat={userLat} lng={userLng} radiusKm={radiusKm} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Circle
            center={userLocation}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.06,
              weight: 1.5,
              dashArray: "4, 4",
            }}
          />

          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup>
              <strong>Your Current Location</strong>
            </Popup>
          </Marker>

          {selected && (
            <Polyline
              positions={[userLocation, selected._pos]}
              pathOptions={{ color: "#2563eb", weight: 3, dashArray: "8, 6" }}
            >
              <Tooltip permanent direction="center">
                {formatDistance(selected._distKm)}
              </Tooltip>
            </Polyline>
          )}

          {nearby.map((station, i) => {
            const id = station.id ?? station._id ?? i;
            return (
              <Marker
                key={id}
                position={station._pos}
                icon={getStationIcon(getStationColor(station))}
                eventHandlers={{
                  click: () => setSelectedId(id),
                  popupclose: () => setSelectedId((cur) => (cur === id ? null : cur)),
                }}
              >
                <Popup>
                  <div style={{ minWidth: "170px" }}>
                    <strong className="text-dark">{station.name}</strong>
                    <br />
                    <span className="text-muted small">{station.address}</span>
                    <hr className="my-1" />
                    <strong>Distance:</strong> {formatDistance(station._distKm)}
                    <br />
                    <strong>Status:</strong> {station.status || "N/A"}
                    <br />
                    <strong>Available Chargers:</strong> {station.availableChargers ?? "N/A"} /{" "}
                    {station.totalChargers ?? "N/A"}
                    <br />
                    <strong>Connectors:</strong>{" "}
                    {normalizeConnectors(station.connectorTypes || station.connectors).join(", ") || "N/A"}
                    <br />
                    <strong>Price:</strong> ₹{station.price ?? "N/A"}/kWh
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="card-footer bg-white py-2 px-3 border-top d-flex align-items-center gap-4 flex-wrap text-muted small">
        {[
          ["#2563eb", "Your location"],
          [GREEN, "All chargers available"],
          [ORANGE, "Partially available"],
          [RED, "Fully occupied or offline"],
        ].map(([color, label]) => (
          <div key={label} className="d-flex align-items-center gap-1">
            <span
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: color,
                borderRadius: "50%",
                display: "inline-block",
              }}
            ></span>
            <span>{label}</span>
          </div>
        ))}
        <span className="ms-auto">Distances are straight-line, not road distance.</span>
      </div>
    </div>
  );
}