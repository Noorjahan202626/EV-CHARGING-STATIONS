import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Simple icons (reuse from StationMap if needed)
const userIcon = L.divIcon({
  className: "custom-user-pin",
  html: `<div style="width:20px;height:20px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(37,99,235,0.7);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const stationIcon = L.divIcon({
  className: "custom-station-pin",
  html: `<div style="width:28px;height:40px;background:#10b981;border-radius:5px;"></div>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, points]);
  return null;
}

export default function RoutePage() {
  const { stationId } = useParams(); // url like /route/:stationId
  const [station, setStation] = useState(null);
  const [userLoc, setUserLoc] = useState(null);

  // fetch station details
  useEffect(() => {
    fetch(`/api/stations/${stationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        const s = d.station || d; // API may return {station: {...}}
        setStation(s);
      })
      .catch(() => setStation(null));
  }, [stationId]);

  // get user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
        () => setUserLoc(null)
      );
    }
  }, []);

  if (!station || !userLoc) {
    return <div className="container my-4"><p>Loading map...</p></div>;
  }

  const stationPos = [station.lat ?? station.latitude, station.lng ?? station.longitude];

  return (
    <div className="container my-4">
      <h2 className="mb-3">Route to {station.name}</h2>
      <MapContainer center={userLoc} zoom={13} style={{ height: "500px", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={userLoc} icon={userIcon}>
          <Popup>Your location</Popup>
        </Marker>
        <Marker position={stationPos} icon={stationIcon}>
          <Popup>{station.name}</Popup>
        </Marker>
        <Polyline positions={[userLoc, stationPos]} color="#0b6b57" weight={4} />
        <FitBounds points={[userLoc, stationPos]} />
      </MapContainer>
    </div>
  );
}
