import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CompatibilityFilter from "../components/Map/CompatibilityFilter";
import StationMap from "../components/Map/StationMap";
import NearbyDistance from "../components/Map/NearbyDistance.jsx";

// Set to false once everything works
const DEBUG = true;

// Pulls the station array out of whatever shape the API returns
const extractStations = (d) => {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== "object") return [];
  return d.stations || d.data || d.results || [];
};

// Lists of connectors on a station can be objects or plain strings
const getConnectorList = (station) => {
  const list = station.connectors || station.connectorTypes || [];
  return Array.isArray(list) ? list : [];
};

// "CCS 2 (DC)" -> "CCS2", "GB/T" -> "GBT", 5 -> "5"
const norm = (v) =>
  String(v ?? "")
    .replace(/\(.*?\)/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// Every identifier a station connector might carry (id, code, name, plain string...)
const connectorTokens = (c) => {
  if (c == null) return [];
  if (typeof c !== "object") return [norm(c)];
  return [c.type_id, c.typeId, c.id, c.type, c.code, c.name, c.connector_type, c.connectorType]
    .filter((x) => x != null && x !== "")
    .map(norm);
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user = localStorage.getItem("user");

  const [filter, setFilter] = useState(null);
  const [stations, setStations] = useState([]);
  const [stationsError, setStationsError] = useState(null);
  const [loadingStations, setLoadingStations] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // [lat, lng] detected from user's GPS
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [radiusKm, setRadiusKm] = useState(5);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Get the user's location once
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported by your browser. Please use a browser that supports location services.");
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationLoading(false);
        setLocationError(null);
      },
      (err) => {
        console.warn("Geolocation failed:", err);
        setLocationError("Please enable location access in your browser to view charging stations near your location.");
        setLocationLoading(false);
        setUserLocation(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Fetch stations filtered by location and radius from backend
  useEffect(() => {
    if (!userLocation || !Array.isArray(userLocation)) {
      setStations([]);
      setLoadingStations(false);
      return;
    }
    const [lat, lng] = userLocation;
    const token =
      JSON.parse(localStorage.getItem("user") || "{}").token || localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const controller = new AbortController();

    setLoadingStations(true);
    const queryParams = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(radiusKm),
    });

    fetch(`/api/stations?${queryParams.toString()}`, { headers, signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((d) => {
        const list = extractStations(d);
        if (DEBUG) {
          console.log("RAW /api/stations response:", d);
          console.log("stations parsed:", list.length, "| first:", list[0]);
        }
        setStations(list);
        setStationsError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        console.error("Stations fetch failed:", e);
        setStations([]);
        setStationsError(e.message || "Could not load stations");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStations(false);
      });

    return () => controller.abort();
  }, [userLocation, radiusKm]);

  // Compatibility filtering lives here only. The map receives already-filtered stations.
  const filteredStations = useMemo(() => {
    if (!stations.length || !filter) return stations;

    return stations.filter((station) => {
      const connectors = getConnectorList(station);

      // 1. Connector compatibility: the station must have the ONE selected connector
      const wanted = [filter.connectorTypeId, filter.connectorCode].filter(Boolean).map(norm);
      if (wanted.length > 0) {
        const ok = connectors.some((c) => connectorTokens(c).some((t) => wanted.includes(t)));
        if (!ok) return false;
      }

      // 2. Current type (AC / DC)
      if (filter.currentType && filter.currentType !== "ALL") {
        const wanted = String(filter.currentType).toUpperCase();
        const stationCurrent = station.currentType
          ? String(station.currentType).toUpperCase()
          : null;
        const currentTypesList = Array.isArray(station.currentTypes)
          ? station.currentTypes.map((t) => String(t).toUpperCase())
          : [];
        const hasDirectCurrentType = currentTypesList.includes(wanted) || stationCurrent === wanted;

        const connectorMatch = connectors.some((c) => {
          if (typeof c === "object" && c != null) {
            const ct = String(c.current_type ?? c.currentType ?? "").toUpperCase();
            if (ct === wanted) return true;
          }
          const token = typeof c === "string" ? c : c?.code || c?.type || "";
          const tNorm = String(token).toUpperCase();
          if (wanted === "DC" && /\bDC\b|CCS|CHADEMO|GB[\s/_-]*T/.test(tNorm)) return true;
          if (wanted === "AC" && /\bAC\b|TYPE[\s_-]*2|15A|SOCKET/.test(tNorm)) return true;
          return false;
        });

        if (!hasDirectCurrentType && !connectorMatch) return false;
      }

      // 3. Available only
      if (filter.availableOnly) {
        const status = String(station.status || "").toUpperCase();
        const avail = Number(station.availableChargers);
        const noneFree = Number.isFinite(avail) && avail <= 0;
        const badStatus = ["FULL", "OCCUPIED", "OFFLINE", "INACTIVE"].includes(status);
        if (noneFree || badStatus) return false;
      }

      return true;
    });
  }, [stations, filter]);

  return (
    <div className="container my-4">
      <h2 className="mb-3">EV Charging Stations</h2>

      {stationsError && (
        <div className="alert alert-danger">Could not load stations: {stationsError}</div>
      )}

      <div className="d-flex" style={{ minHeight: "500px" }}>
        <div style={{ width: "260px", flexShrink: 0 }}>
          <CompatibilityFilter onFiltersChange={setFilter} />
        </div>

        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="map-wrapper" style={{ width: "100%" }}>
            {/* Stations are already filtered above, so `filter` is not passed to the map */}
            <StationMap
              stationsData={filteredStations}
              userLocation={userLocation}
              radiusKm={radiusKm}
              onRadiusChange={setRadiusKm}
            />
          </div>
        </div>
      </div>

      <div className="mt-4" style={{ width: "100%" }}>
        {locationError && <div className="alert alert-warning">{locationError}</div>}
        {locationLoading ? (
          <div className="text-muted py-2 d-flex align-items-center">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Detecting your location...
          </div>
        ) : loadingStations ? (
          <div className="text-muted py-2 d-flex align-items-center">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Loading stations near you...
          </div>
        ) : (
          <NearbyDistance
            stations={filteredStations}
            userLocation={userLocation}
            radiusKm={radiusKm}
          />
        )}
      </div>
    </div>
  );
}