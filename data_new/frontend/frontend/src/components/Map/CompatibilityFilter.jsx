import React, { useEffect, useMemo, useState } from "react";
import "./CompatibilityFilter.css";

// Fallback connector list (used if the API returns none)
const CONNECTOR_TYPES = [
  { id: "TYPE2", code: "Type 2 (AC)" },
  { id: "CCS2", code: "CCS 2 (DC)" },
  { id: "CHADEMO", code: "CHAdeMO" },
  { id: "GBT", code: "GB/T" },
  { id: "15A_SOCKET", code: "15A Socket" },
];

const VEHICLE_TYPES = [
  { id: "2W", label: "2 Wheeler (2W)" },
  { id: "3W", label: "3 Wheeler (3W)" },
  { id: "4W", label: "4 Wheeler (4W)" },
];

const getAuthHeaders = () => {
  let token = localStorage.getItem("token");
  if (!token) {
    try {
      token = JSON.parse(localStorage.getItem("user") || "{}").token;
    } catch {
      token = null;
    }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Accepts [..], { vehicles: [..] }, { data: [..] } etc.
const pickList = (d, key) => {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== "object") return [];
  const list = d[key] || d.data || d.results || [];
  return Array.isArray(list) ? list : [];
};

/**
 * CompatibilityFilter – calls `onFiltersChange` with:
 *   vehicleId, vehicleType,
 *   connectorTypeId   – the ONE selected connector id (or null = any)
 *   connectorCode     – its display code, e.g. "CCS 2 (DC)" (or null)
 *   connectorTypeIds  – [connectorTypeId] or [] (kept for older consumers)
 *   currentType       – null | "AC" | "DC"
 *   availableOnly
 */
export default function CompatibilityFilter({ onFiltersChange }) {
  const [vehicles, setVehicles] = useState([]);
  const [connectorTypes, setConnectorTypes] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedConnector, setSelectedConnector] = useState(""); // single id as string, "" = any
  const [vehicleType, setVehicleType] = useState("2W");
  const [currentType, setCurrentType] = useState("ALL");
  const [availableOnly, setAvailableOnly] = useState(true);

  const connectorList = connectorTypes.length ? connectorTypes : CONNECTOR_TYPES;

  // Load vehicles
  useEffect(() => {
    fetch("/api/me/vehicles", { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then((d) => {
        const list = pickList(d, "vehicles");
        setVehicles(list);
        if (list.length) {
          const v = list[0];
          setSelectedVehicle(v.id);
          if (v.category_code) setVehicleType(v.category_code);
          // A vehicle may list several connectors; the filter takes only one (the first)
          const first = (v.connector_type_ids || [])[0];
          setSelectedConnector(first != null ? String(first) : "");
        }
      })
      .catch((e) => {
        console.warn("Vehicles load failed:", e);
        setVehicles([]);
      });
  }, []);

  // Load connector catalogue
  useEffect(() => {
    fetch("/api/connector-types", { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then((d) => setConnectorTypes(pickList(d, "connectorTypes")))
      .catch((e) => {
        console.warn("Connector types load failed, using fallback list:", e);
        setConnectorTypes([]);
      });
  }, []);

  const selectedConnectorObj = useMemo(
    () => connectorList.find((ct) => String(ct.id) === selectedConnector) || null,
    [connectorList, selectedConnector]
  );

  // Push filter changes upstream
  useEffect(() => {
    if (!onFiltersChange) return;
    onFiltersChange({
      vehicleId: selectedVehicle,
      vehicleType,
      connectorTypeId: selectedConnectorObj ? selectedConnectorObj.id : null,
      connectorCode: selectedConnectorObj ? selectedConnectorObj.code : null,
      connectorTypeIds: selectedConnectorObj ? [selectedConnectorObj.id] : [],
      currentType: currentType === "ALL" ? null : currentType,
      availableOnly,
    });
  }, [selectedVehicle, vehicleType, selectedConnectorObj, currentType, availableOnly, onFiltersChange]);

  const showGbtOnly = () => {
    const gbt = connectorList.find((ct) =>
      /GB\s*\/?\s*T/i.test(`${ct.id} ${ct.code}`.replace(/[^A-Za-z/ ]/g, ""))
    );
    if (gbt) setSelectedConnector(String(gbt.id));
  };

  return (
    <div className="compatibility-filter p-3 border rounded bg-white">
      <h5 className="mb-3">Compatibility Filter</h5>

      {/* Vehicle selector */}
      <div className="mb-3">
        {vehicles.length === 0 ? (
          <div className="text-muted">No vehicle registered</div>
        ) : (
          <>
            <label htmlFor="vehicleSelect" className="form-label">My Vehicle</label>
            <select
              id="vehicleSelect"
              className="form-select"
              value={selectedVehicle ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedVehicle(id);
                const v = vehicles.find((x) => x.id === id);
                if (v) {
                  if (v.category_code) setVehicleType(v.category_code);
                  const first = (v.connector_type_ids || [])[0];
                  setSelectedConnector(first != null ? String(first) : "");
                }
              }}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {`${v.registration_no} · ${v.category_code}`}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Vehicle type */}
      <div className="mb-3">
        <label htmlFor="vehicleTypeSelect" className="form-label">Vehicle Type</label>
        <select
          id="vehicleTypeSelect"
          className="form-select"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
        >
          {VEHICLE_TYPES.map((vt) => (
            <option key={vt.id} value={vt.id}>
              {vt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Connector type: ONE choice only (radio buttons) */}
      <div className="mb-3">
        <label className="form-label">Connector Type</label>
        <div className="d-flex flex-column gap-1">
          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="connectorType"
              id="conn-any"
              checked={selectedConnector === ""}
              onChange={() => setSelectedConnector("")}
            />
            <label className="form-check-label" htmlFor="conn-any">
              Any connector
            </label>
          </div>
          {connectorList.map((ct) => (
            <div className="form-check" key={ct.id}>
              <input
                className="form-check-input"
                type="radio"
                name="connectorType"
                id={`conn-${ct.id}`}
                checked={selectedConnector === String(ct.id)}
                onChange={() => setSelectedConnector(String(ct.id))}
              />
              <label className="form-check-label" htmlFor={`conn-${ct.id}`}>
                {ct.code}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Quick connector shortcut */}
      <div className="mb-3">
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={showGbtOnly}>
          Show GB/T stations only
        </button>
      </div>

      {/* AC/DC */}
      <div className="mb-3">
        <label htmlFor="currentType" className="form-label">Current Type</label>
        <select
          id="currentType"
          className="form-select"
          value={currentType}
          onChange={(e) => setCurrentType(e.target.value)}
        >
          <option value="ALL">All</option>
          <option value="AC">AC</option>
          <option value="DC">DC</option>
        </select>
      </div>

      {/* Availability */}
      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="availableOnly"
          checked={availableOnly}
          onChange={(e) => setAvailableOnly(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="availableOnly">
          Available now only
        </label>
      </div>
    </div>
  );
}