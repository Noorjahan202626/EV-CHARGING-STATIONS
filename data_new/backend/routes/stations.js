import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/stations", async (req, res) => {
    try {
        // Query matching the V3 schema: stations -> chargers -> connector_types
        const query = `
      SELECT
        s.station_id AS id,
        s.name,
        s.address,
        s.latitude,
        s.longitude,
        s.tariff_per_kwh AS price,
        s.status,
        COUNT(c.charger_id)::int AS "totalChargers",
        SUM(CASE WHEN UPPER(c.status) = 'AVAILABLE' THEN 1 ELSE 0 END)::int AS "availableChargers",
        COALESCE(ARRAY_AGG(DISTINCT ct.code) FILTER (WHERE ct.code IS NOT NULL), '{}') AS "connectorTypes"
      FROM stations s
      LEFT JOIN chargers c ON s.station_id = c.station_id
      LEFT JOIN connector_types ct ON c.connector_type_id = ct.connector_type_id
      GROUP BY s.station_id;
    `;

        const result = await pool.query(query);

        // Format the response for the frontend map
        const stations = result.rows.map(r => ({
            id: r.id,
            name: r.name || "Unknown Station",
            address: r.address || "Address not provided",
            position: [
                Number(r.latitude) || 12.9716,
                Number(r.longitude) || 77.5946
            ],
            price: Number(r.price) || 0,
            status: r.status || "Unknown",
            totalChargers: r.totalChargers || 0,
            availableChargers: r.availableChargers || 0,
            connectorTypes: r.connectorTypes || [],
        }));

        res.json({ ok: true, stations });
    } catch (e) {
        console.error("Stations API error:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

export default router;