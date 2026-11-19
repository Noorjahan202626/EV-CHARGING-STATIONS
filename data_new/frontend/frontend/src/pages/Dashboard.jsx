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
  const [loadingStations, setLoadingStations] = useState(true);
  const [userLocation, setUserLocation] = useState(null); // [lat, lng]
  const [locationError, setLocationError] = useState(null);
  const [radiusKm, setRadiusKm] = useState(5);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Fetch stations once
  useEffect(() => {
    const token =
      JSON.parse(localStorage.getItem("user") || "{}").token || localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const controller = new AbortController();

    fetch("/api/stations", { headers, signal: controller.signal })
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
  }, []);

  // Get the user's location once
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("Location is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationError(null);
      },
      (err) => {
        console.warn("Geolocation failed:", err);
        setLocationError("Allow location access to see stations near you.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

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
        const connectorMatch = connectors.some(
          (c) =>
            typeof c === "object" &&
            String(c.current_type ?? c.currentType ?? "").toUpperCase() === wanted
        );
        // Only reject if the data actually has a current type to compare against
        const hasCurrentData =
          stationCurrent !== null ||
          connectors.some((c) => typeof c === "object" && (c.current_type ?? c.currentType));
        if (hasCurrentData && stationCurrent !== wanted && !connectorMatch) return false;
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
        {loadingStations ? (
          <div className="text-muted">Loading stations...</div>
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