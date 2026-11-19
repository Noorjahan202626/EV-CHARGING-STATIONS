import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/stations", async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    const qLat = parseFloat(lat);
    const qLng = parseFloat(lng);
    const qRadius = parseFloat(radius);

    const hasGeoFilter =
      !Number.isNaN(qLat) &&
      !Number.isNaN(qLng) &&
      !Number.isNaN(qRadius) &&
      qRadius > 0;

    let whereClause = `
      WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        AND s.latitude::float <> 0 AND s.longitude::float <> 0
    `;
    const queryParams = [];

    if (hasGeoFilter) {
      const latDelta = qRadius / 111.0;
      const cosLat = Math.cos((qLat * Math.PI) / 180);
      const lngDelta = cosLat > 0.0001 ? qRadius / (111.0 * cosLat) : qRadius / 111.0;

      queryParams.push(qLat, qLng, qRadius, latDelta, lngDelta);

      whereClause += `
        AND s.latitude::float BETWEEN ($1::float - $4::float) AND ($1::float + $4::float)
        AND s.longitude::float BETWEEN ($2::float - $5::float) AND ($2::float + $5::float)
        AND (
          6371 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS($1::float)) * COS(RADIANS(s.latitude::float)) * COS(RADIANS(s.longitude::float) - RADIANS($2::float)) +
              SIN(RADIANS($1::float)) * SIN(RADIANS(s.latitude::float))
            ))
          )
        ) <= $3::float
      `;
    }

    const query = `
      SELECT
        s.station_id AS id,
        s.name,
        s.address,
        s.latitude,
        s.longitude,
        s.tariff_per_kwh AS price,
        s.tariff_per_kwh,
        s.status,
        COUNT(DISTINCT c.charger_id)::int AS "totalChargers",
        COUNT(DISTINCT CASE WHEN UPPER(c.status) = 'AVAILABLE' THEN c.charger_id END)::int AS "availableChargers",
        COALESCE(ARRAY_AGG(DISTINCT ct.code) FILTER (WHERE ct.code IS NOT NULL), '{}') AS "connectorTypes",
        COALESCE(ARRAY_AGG(DISTINCT ct.current_type) FILTER (WHERE ct.current_type IS NOT NULL), '{}') AS "currentTypes",
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', ct.connector_type_id,
              'code', ct.code,
              'current_type', ct.current_type
            )
          ) FILTER (WHERE ct.code IS NOT NULL),
          '[]'
        ) AS connectors
      FROM stations s
      LEFT JOIN chargers c ON s.station_id = c.station_id
      LEFT JOIN connector_types ct ON c.connector_type_id = ct.connector_type_id
      ${whereClause}
      GROUP BY s.station_id;
    `;

    const result = await pool.query(query, queryParams);

    const stations = result.rows.map((r) => {
      const latVal = Number(r.latitude);
      const lngVal = Number(r.longitude);
      const hasValidCoords = Number.isFinite(latVal) && Number.isFinite(lngVal) && latVal !== 0 && lngVal !== 0;

      return {
        id: r.id,
        name: r.name || "Unknown Station",
        address: r.address || "Address not provided",
        latitude: latVal,
        longitude: lngVal,
        position: hasValidCoords ? [latVal, lngVal] : null,
        price: Number(r.price ?? r.tariff_per_kwh) || 0,
        tariff_per_kwh: Number(r.tariff_per_kwh ?? r.price) || 0,
        status: r.status || "Unknown",
        totalChargers: r.totalChargers || 0,
        availableChargers: r.availableChargers || 0,
        connectorTypes: r.connectorTypes || [],
        currentTypes: r.currentTypes || [],
        connectors: r.connectors || [],
      };
    });

    res.json({ ok: true, stations });
  } catch (e) {
    console.error("Stations API error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;