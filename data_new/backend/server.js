// backend/server.js
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAuth } from "./middleware/auth.js";
import "dotenv/config";
import { pool } from "./db.js";
import * as crypto from "crypto";
import meVehiclesRouter from "./routes/meVehicles.js"; // Adjust path if needed
import stationsRouter from "./routes/stations.js";
import { validateIndianVehicleNumber } from "./utils/vehicleValidation.js";
import { validateEmail } from "./utils/authValidation.js";
const app = express();
// expose pool to routers via app.locals
app.locals.pool = pool;
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"] }));
app.use(express.json());
app.use(meVehiclesRouter);

// This line properly connects to your newly created routes/stations.js file
app.use("/api", stationsRouter);

// Helper functions for secure password hashing using bcrypt
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
}

export async function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    if (storedHash.includes(":")) {
        const [salt, originalHash] = storedHash.split(":");
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
        return hash === originalHash;
    }
    return await bcrypt.compare(password, storedHash);
}

// Data endpoint (station and network stats)
app.get("/api/data", requireAuth, async (req, res) => {
    try {
        const r = await pool.query("SELECT COUNT(*) AS stations FROM stations");
        res.json({ ok: true, stations: Number(r.rows[0].stations) });
    } catch (e) {
        console.error("Data API error:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Database connection status
app.get("/api/whoami", async (req, res) => {
    try {
        const db = await pool.query("SELECT current_database() AS db, current_user AS usr");
        const t = await pool.query(
            "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'stations'"
        );
        res.json({ connected_to: db.rows[0], stations_tables: t.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/connector-types
app.get("/api/connector-types", requireAuth, async (req, res) => {
    try {
        // Fetch all connector types from the database with current_type (AC/DC) and description
        const result = await pool.query(
            "SELECT connector_type_id AS id, code, description, current_type FROM connector_types ORDER BY connector_type_id"
        );
        res.json({
            ok: true,
            connectorTypes: result.rows
        });
    } catch (e) {
        console.error("Connector types error:", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// REGISTER ENDPOINT: POST /api/register
app.post("/api/register", async (req, res) => {
    const { name, email, password, registrationNo, vehicleType } = req.body;

    if (!name?.trim()) return res.status(400).json({ ok: false, error: "Full name is required." });
    
    // Email validation & canonicalization (Gmail-specific & General provider rules)
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ ok: false, error: emailValidation.error });
    }
    const cleanEmail = emailValidation.normalized;
    const canonicalEmail = emailValidation.canonical;
    
    // Password validation: minimum 8 characters, at least one uppercase letter, one digit, and one special character
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!password || !passwordRegex.test(password)) {
        return res.status(400).json({
            ok: false,
            error: "Password must be at least 8 characters long and contain at least one uppercase letter, one digit, and one special character."
        });
    }

    // Registration number validation (MoRTH Indian Standard RTO & BH series)
    const regValidation = validateIndianVehicleNumber(registrationNo);
    if (!regValidation.valid) {
        return res.status(400).json({ ok: false, error: regValidation.error });
    }
    const cleanRegNo = regValidation.normalized;

    if (!vehicleType?.trim()) return res.status(400).json({ ok: false, error: "Vehicle type is required." });

    const client = await pool.connect();
    try {
        const emailCheck = await client.query(
            "SELECT user_id FROM users WHERE canonical_email = $1 OR LOWER(email) = LOWER($2)",
            [canonicalEmail, cleanEmail]
        );
        if (emailCheck.rows.length > 0) {
            return res.status(409).json({ ok: false, error: "An account with this email address already exists." });
        }

        const regCheck = await client.query(
            "SELECT vehicle_id FROM vehicles WHERE UPPER(registration_no) = UPPER($1)",
            [cleanRegNo]
        );
        if (regCheck.rows.length > 0) {
            return res.status(409).json({ ok: false, error: "This vehicle registration number is already registered." });
        }

        let categoryId = null;
        const catRes = await client.query(
            "SELECT category_id FROM vehicle_categories WHERE UPPER(code) = UPPER($1)",
            [vehicleType.trim()]
        );
        if (catRes.rows.length > 0) {
            categoryId = catRes.rows[0].category_id;
        } else {
            const fallbackCat = await client.query("SELECT category_id FROM vehicle_categories ORDER BY category_id LIMIT 1");
            categoryId = fallbackCat.rows[0]?.category_id;
        }

        const passwordHash = await hashPassword(password);

        await client.query("BEGIN");

        const userInsert = await client.query(
            `INSERT INTO users (name, email, canonical_email, password_hash, role)
             VALUES ($1, $2, $3, $4, 'USER')
             RETURNING user_id, name, email, canonical_email, role`,
            [name.trim(), cleanEmail, canonicalEmail, passwordHash]
        );
        const newUser = userInsert.rows[0];

        const vehicleInsert = await client.query(
            `INSERT INTO vehicles (registration_no, user_id, category_id)
             VALUES ($1, $2, $3)
             RETURNING vehicle_id, registration_no`,
            [cleanRegNo, newUser.user_id, categoryId]
        );
        const newVehicle = vehicleInsert.rows[0];

        // Insert default connector compatibility rows for the new vehicle based on its category
        await client.query(
            `INSERT INTO vehicle_connector_compatibility (vehicle_id, connector_type_id)
             SELECT $1, ct.connector_type_id
             FROM connector_types ct
             WHERE ct.code = ANY(
                 CASE (
                     SELECT vc.code FROM vehicle_categories vc WHERE vc.category_id = $2
                 )
                 WHEN '4W' THEN ARRAY['CCS2','TYPE2_AC']
                 WHEN '3W' THEN ARRAY['BHARAT_AC001','BHARAT_DC001','LEV_AC','LEV_DC']
                 WHEN '2W' THEN ARRAY['LEV_AC','LEV_DC']
                 ELSE ARRAY[]::text[]
                 END
             )
             ON CONFLICT DO NOTHING;`,
            [newVehicle.vehicle_id, categoryId]
        );

        await client.query("COMMIT");

        res.status(201).json({
            ok: true,
            message: "Account created successfully!",
            user: newUser,
            vehicle: newVehicle
        });
    } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
            if (
                err.constraint === "users_canonical_email_unique" ||
                err.constraint === "users_email_key" ||
                err.detail?.includes("email") ||
                err.detail?.includes("canonical_email")
            ) {
                return res.status(409).json({ ok: false, error: "An account with this email address already exists." });
            }
            if (err.detail?.includes("registration_no")) {
                return res.status(409).json({ ok: false, error: "This vehicle registration number is already registered." });
            }
            return res.status(409).json({ ok: false, error: "An account with these details already exists." });
        }
        console.error("Registration error:", err);
        res.status(500).json({ ok: false, error: "Failed to register. " + err.message });
    } finally {
        client.release();
    }
});

// LOGIN ENDPOINT: POST /api/login
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email and password are required." });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ ok: false, error: emailValidation.error });
    }
    const cleanEmail = emailValidation.normalized;
    const canonicalEmail = emailValidation.canonical;

    try {
        const result = await pool.query(
            `SELECT user_id, name, email, canonical_email, password_hash, role 
             FROM users 
             WHERE canonical_email = $1 OR LOWER(email) = LOWER($2)
             LIMIT 1`,
            [canonicalEmail, cleanEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ ok: false, error: "Invalid email or password." });
        }

        const user = result.rows[0];
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ ok: false, error: "Invalid email or password." });
        }

        const payload = {
            userId: user.user_id,
            email: user.email,
            role: user.role,
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET_KEY || "dev-secret", { expiresIn: "2h" });
        res.json({
            ok: true,
            message: "Login successful!",
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ ok: false, error: "Login failed: " + err.message });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));