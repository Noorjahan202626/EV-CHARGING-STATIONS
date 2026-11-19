// backend/scripts/migrate_canonical_email.js
import { pool } from "../db.js";
import { canonicalizeEmail } from "../utils/authValidation.js";

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Adding column canonical_email if not exists...");
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS canonical_email VARCHAR(255);
    `);

    const { rows: users } = await client.query("SELECT user_id, email FROM users");
    console.log(`Found ${users.length} existing users. Backfilling canonical_email...`);

    for (const u of users) {
      const canonical = canonicalizeEmail(u.email);
      await client.query(
        "UPDATE users SET canonical_email = $1 WHERE user_id = $2",
        [canonical, u.user_id]
      );
    }

    console.log("Creating UNIQUE index on canonical_email...");
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_canonical_email_unique 
      ON users(canonical_email);
    `);

    await client.query("COMMIT");
    console.log("✅ Migration completed successfully!");

    const sample = await pool.query(
      "SELECT user_id, email, canonical_email FROM users LIMIT 5"
    );
    console.log("Sample records:", sample.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
