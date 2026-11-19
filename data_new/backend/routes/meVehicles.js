// backend/routes/meVehicles.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db.js"; // Import pool directly to fix the 500 error!

const router = express.Router();

// GET /api/me/vehicles  (requires auth)
router.get("/api/me/vehicles", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT v.vehicle_id          AS id,
        v.registration_no,

        vc.code               AS category_code,
        COALESCE(array_agg(ct.connector_type_id)
                    FILTER(WHERE ct.connector_type_id IS NOT NULL), '{}')
                                  AS connector_type_ids
      FROM vehicles v
      JOIN vehicle_categories vc ON v.category_id = vc.category_id
      LEFT JOIN vehicle_connector_compatibility vcc
             ON v.vehicle_id = vcc.vehicle_id
      LEFT JOIN connector_types ct
             ON vcc.connector_type_id = ct.connector_type_id
      WHERE v.user_id = $1
      GROUP BY v.vehicle_id,
        v.registration_no,

        vc.code;
    `;

    const result = await pool.query(query, [req.user.userId]);

    // Return the array under the key expected by the frontend
    res.json({ ok: true, vehicles: result.rows });

  } catch (e) {
    console.error("Get vehicles error:", e);
    res.status(500).json({ ok: false, error: e.message });
  } // <--- THESE CLOSING BRACKETS WERE MISSING
});

// PUT /api/vehicles/:id/connectors  (replace connectors for a vehicle)
router.put("/api/vehicles/:id/connectors", requireAuth, async (req, res) => {
  const vehicleId = parseInt(req.params.id, 10);
  const { connectorTypeIds } = req.body; // array of numbers

  if (!Array.isArray(connectorTypeIds)) {
    return res.status(400).json({ ok: false, error: "connectorTypeIds must be an array" });
  }

  try {
    // Verify ownership
    const ownerCheck = await pool.query(
      `SELECT 1 FROM vehicles WHERE vehicle_id = $1 AND user_id = $2`,
      [vehicleId, req.user.userId]
    );

    if (ownerCheck.rowCount === 0) {
      return res.status(403).json({ ok: false, error: "Not authorized for this vehicle" });
    }

    await pool.query('BEGIN');

    // Remove existing rows
    await pool.query(
      `DELETE FROM vehicle_connector_compatibility WHERE vehicle_id = $1`,
      [vehicleId]
    );

    // Insert new rows
    if (connectorTypeIds.length > 0) {
      const values = connectorTypeIds.map((id, idx) => `($1, $${idx + 2})`).join(',');
      const params = [vehicleId, ...connectorTypeIds];
      await pool.query(
        `INSERT INTO vehicle_connector_compatibility (vehicle_id, connector_type_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }

    await pool.query('COMMIT');
    res.json({ ok: true, message: 'Connectors updated' });

  } catch (e) {
    await pool.query('ROLLBACK');
    console.error("Update connectors error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;