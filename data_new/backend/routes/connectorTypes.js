// backend/routes/connectorTypes.js
// Exposes GET /api/connector-types (auth required)
import express from "express";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/api/connector-types", requireAuth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query(
      `SELECT connector_type_id AS id, code, description, current_type FROM connector_types ORDER BY code`
    );
    res.json({ ok: true, connectorTypes: result.rows });
  } catch (e) {
    console.error("Connector types error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
