// src/components/Map/NearbyDistance.jsx
import React, { useMemo } from "react";
import { haversineKm, fmtDistance } from "./mapUtils";

/**
 * Props
 *  - stations: array of station objects coming from /api/stations
 *  - userLocation: [lat, lng]
 *  - radiusKm: number – maximum radius the user wants to see
 */

// Set to false once everything works
const DEBUG = true;

// Try every common field name and return [lat, lng] or null if invalid
function getStationPosition(s) {
    const lat = Number(
        s.latitude ?? s.lat ?? s.position?.[0] ?? s.location?.lat ?? s.location?.latitude
    );
    const lng = Number(
        s.longitude ?? s.lng ?? s.lon ?? s.position?.[1] ?? s.location?.lng ?? s.location?.longitude
    );
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
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
    // -----------------------------------------------------------------
    // DEBUG: what is this component actually receiving?
    // -----------------------------------------------------------------
    if (DEBUG) {
        console.log("NearbyDistance rendered");
        console.log("stations count:", stations?.length);
        console.log("first station:", stations?.[0]);
        console.log("userLocation:", userLocation, "| isArray:", Array.isArray(userLocation));
        console.log("radiusKm:", radiusKm, "| type:", typeof radiusKm);
    }

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

        if (DEBUG) {
            console.table(
                all.map((s) => ({
                    name: s.name,
                    rawLatitude: s.latitude,
                    rawLongitude: s.longitude,
                    rawPosition: JSON.stringify(s.position),
                    pos: JSON.stringify(s._pos),
                    distKm: s._distKm,
                    insideRadius: s._distKm <= radius,
                }))
            );
        }

        return all
            .filter((s) => s._pos && s._distKm <= radius) // valid coords + inside radius
            .sort((a, b) => a._distKm - b._distKm); // nearest first
    }, [stations, userLocation, radiusKm]);

    if (DEBUG) console.log("nearby result:", nearby.length, nearby);

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------
    return (
        <div className="card mt-3">
            <div className="card-header bg-white fw-bold">
                Stations within {fmtDistance(Number(radiusKm) || 0)}
            </div>
            <ul className="list-group list-group-flush">
                {nearby.length === 0 && (
                    <li className="list-group-item text-muted">
                        No stations found in the selected radius.
                    </li>
                )}
                {nearby.map((st, i) => (
                    <li
                        key={st.id ?? `${st.name}-${i}`}
                        className="list-group-item d-flex justify-content-between align-items-center"
                    >
                        <div>
                            <strong>{st.name}</strong>
                            <br />
                            <small className="text-muted">{st.address}</small>
                        </div>
                        <span className="badge bg-primary rounded-pill">
                            {fmtDistance(st._distKm)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
