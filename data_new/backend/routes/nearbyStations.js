// backend/routes/nearbyStations.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db.js"; // Import pool directly for reliability

const router = express.Router();

function parseIds(param) {
  if (!param) return null;
  return param.split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
}

// -------------------------------------------------------------
// GET /api/stations/nearby
// -------------------------------------------------------------
router.get("/api/stations/nearby", requireAuth, async (req, res) => {
  const { lat, lng, radiusKm = "5", connectorTypeIds, vehicleId, currentType, minKw, availableOnly = "true", limit = "50" } = req.query;
  const radius = Math.max(0.5, Math.min(100, parseFloat(radiusKm)));
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || latNum < -90 || latNum > 90 || isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ ok: false, error: "Invalid lat/lng parameters" });
  }

  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const connectorIds = connectorTypeIds ? parseIds(connectorTypeIds) : null;
  const vehicleIdNum = vehicleId ? parseInt(vehicleId, 10) : null;
  const available = availableOnly !== "false";

  try {
    // Determine compatible connector ids if not provided
    let compatibleIds = connectorIds;
    if (!compatibleIds && vehicleIdNum) {
      const compRes = await pool.query(
        `SELECT ct.connector_type_id FROM vehicle_connector_compatibility vcc
         JOIN connector_types ct ON vcc.connector_type_id = ct.connector_type_id
         WHERE vcc.vehicle_id = $1`,
        [vehicleIdNum]
      );
      compatibleIds = compRes.rows.map((r) => r.connector_type_id);
    }

    // Build base query with bounding box
    const latDeg = radius / 111.0;
    const lngDeg = radius / (111.0 * Math.cos((latNum * Math.PI) / 180));

    // Fix: Properly map all 6 parameters to avoid overlapping $1 and $2
    const params = [
      latNum,             // $1: center lat
      lngNum,             // $2: center lng
      latNum - latDeg,    // $3: min lat
      latNum + latDeg,    // $4: max lat
      lngNum - lngDeg,    // $5: min lng
      lngNum + lngDeg     // $6: max lng
    ];
    let idx = 7;

    let sql = `WITH filtered AS (\n` +
      ` SELECT s.*, \n` +
      `   6371 * 2 * ASIN(SQRT( POWER(SIN(RADIANS($1 - s.latitude) / 2), 2) +\n` +
      `   COS(RADIANS($1)) * COS(RADIANS(s.latitude)) * POWER(SIN(RADIANS($2 - s.longitude) / 2), 2) )) AS distance_km\n` +
      ` FROM stations s\n` +
      ` WHERE s.latitude BETWEEN $3 AND $4 AND s.longitude BETWEEN $5 AND $6\n` +
      `   AND (s.status IS NULL OR UPPER(s.status) NOT IN ('INACTIVE','UNDER_MAINTENANCE'))\n` +
      `)\n` +
      `SELECT f.station_id AS id, f.name, f.address, f.latitude, f.longitude, ROUND(f.distance_km::numeric,1) AS distance_km,\n` +
      `  COALESCE(f.network_id, NULL) AS network_id,\n` + // Fix: changed s.network_id to f.network_id
      `  (SELECT json_agg(json_build_object('label', ch.label, 'code', ct.code, 'current_type', ct.current_type, 'power_kw', ch.power_kw,\n` +
      `       'free', (UPPER(ch.status) = 'AVAILABLE' AND NOT EXISTS (\n` +
      `         SELECT 1 FROM reservations r WHERE r.charger_id = ch.charger_id AND UPPER(r.status) IN ('CONFIRMED','ACTIVE')\n` +
      `           AND NOW() >= r.slot_start AND NOW() < r.slot_end)))\n` +
      `       )) AS chargers\n` +
      ` FROM filtered f\n` +
      ` LEFT JOIN chargers ch ON ch.station_id = f.station_id\n` +
      ` LEFT JOIN connector_types ct ON ct.connector_type_id = ch.connector_type_id\n`;

    // Apply connector filters
    if (compatibleIds && compatibleIds.length > 0) {
      sql += `   WHERE ct.connector_type_id = ANY($${idx}::int[])`;
      params.push(compatibleIds);
      idx++;
    }

    // Current type filter
    if (currentType) {
      sql += compatibleIds && compatibleIds.length > 0 ? ` AND` : `   WHERE`;
      sql += ` UPPER(ct.current_type) = $${idx}`;
      params.push(currentType.toUpperCase());
      idx++;
    }

    // minKw filter
    if (minKw) {
      sql += ` AND ch.power_kw >= $${idx}`;
      params.push(parseFloat(minKw));
      idx++;
    }

    // Fix: changed s.network_id to f.network_id
    sql += ` GROUP BY f.station_id, f.name, f.address, f.latitude, f.longitude, f.distance_km, f.network_id\n`;

    if (available) {
      sql += ` HAVING COUNT(*) FILTER (WHERE (UPPER(ch.status) = 'AVAILABLE' AND NOT EXISTS (\n` +
        ` SELECT 1 FROM reservations r WHERE r.charger_id = ch.charger_id AND UPPER(r.status) IN ('CONFIRMED','ACTIVE')\n` +
        `   AND NOW() >= r.slot_start AND NOW() < r.slot_end))) > 0`;
    }

    sql += ` ORDER BY f.distance_km ASC LIMIT $${idx}`;
    params.push(limitNum);

    const result = await pool.query(sql, params);
    const stations = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      position: [parseFloat(row.latitude), parseFloat(row.longitude)],
      distance_km: parseFloat(row.distance_km),
      network_id: row.network_id,
      chargers: row.chargers || [],
    }));

    // nearest inside radius is first row (if any)
    const nearest = stations[0] || null;

    // If none or nearestAvailable false when availableOnly, run fallback query for nearest outside radius
    let nearestOutside = null;
    if (!nearest) {
      const fallbackSql = `SELECT s.station_id AS id, s.name, s.address, s.latitude, s.longitude,\n` +
        `  6371 * 2 * ASIN(SQRT( POWER(SIN(RADIANS($1 - s.latitude) / 2), 2) +\n` +
        `  COS(RADIANS($1)) * COS(RADIANS(s.latitude)) * POWER(SIN(RADIANS($2 - s.longitude) / 2), 2) )) AS distance_km\n` +
        ` FROM stations s\n` +
        ` WHERE (s.status IS NULL OR UPPER(s.status) NOT IN ('INACTIVE','UNDER_MAINTENANCE'))\n` +
        ` ORDER BY distance_km ASC LIMIT 1`;
      const fbRes = await pool.query(fallbackSql, [latNum, lngNum]);
      if (fbRes.rowCount) {
        const r = fbRes.rows[0];
        nearestOutside = { id: r.id, name: r.name, address: r.address, position: [parseFloat(r.latitude), parseFloat(r.longitude)], distance_km: parseFloat(r.distance_km) };
      }
    }

    res.json({ ok: true, count: stations.length, nearest, nearestOutsideRadius: nearestOutside, stations });
  } catch (e) {
    console.error('Nearby stations error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});


// -------------------------------------------------------------
// GET /api/stations
// (This was the block pasted inside the nearby route)
// -------------------------------------------------------------
router.get("/api/stations", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.station_id          AS id,
        s.name,
        s.address,
        s.latitude,
        s.longitude,
        s.tariff_per_kwh      AS price,
        s.status,
        COALESCE(s.total_chargers, 0)    AS totalChargers,
        COALESCE(s.available_chargers,0) AS availableChargers,
        -- optional: list of connector codes for compatibility checks
        ARRAY_AGG(ct.code) FILTER (WHERE ct.code IS NOT NULL) AS connectorTypes
      FROM stations s
      LEFT JOIN station_connector_compatibility scc ON s.station_id = scc.station_id
      LEFT JOIN connector_types ct ON scc.connector_type_id = ct.connector_type_id
      GROUP BY s.station_id;
    `);
    const stations = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      position: [Number(r.latitude), Number(r.longitude)],
      price: Number(r.price),
      status: r.status,
      totalChargers: Number(r.totalchargers),
      availableChargers: Number(r.availablechargers),
      connectorTypes: r.connectortypes || [],   // used by CompatibilityFilter
    }));
    res.json({ ok: true, stations });
  } catch (e) {
    console.error("Stations API error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;