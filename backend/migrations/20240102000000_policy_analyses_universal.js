// backend/migrations/20240102000000_policy_analyses_universal.js
// Creates the policy_analyses table (if not exists) with the full universal insurance schema.
// Run: node migrations/20240102000000_policy_analyses_universal.js

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME     || "vaultlife_db",
  user:     process.env.DB_USER     || "vaultlife_user",
  password: process.env.DB_PASSWORD || "",
  ssl:      process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("[Migration] Setting up policy_analyses table...");

    // Step 1: Create base table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_analyses (
        id                       SERIAL PRIMARY KEY,
        user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name                TEXT NOT NULL,
        policy_holder            TEXT,
        policy_number            TEXT,
        plan_name                TEXT,
        policy_type              TEXT,
        policy_period            TEXT,
        zone                     TEXT,
        pre_existing_diseases    TEXT,
        insured_members          JSONB DEFAULT '[]',
        nominee                  JSONB DEFAULT '{}',
        premium                  JSONB DEFAULT '{}',
        tax_benefit              DECIMAL(14,2) DEFAULT 0,
        total_effective_coverage DECIMAL(14,2) DEFAULT 0,
        bonus_accumulated        DECIMAL(14,2) DEFAULT 0,
        bonus_type               TEXT,
        coverage_projection      JSONB DEFAULT '[]',
        key_benefits             JSONB DEFAULT '[]',
        waiting_periods          JSONB DEFAULT '[]',
        zone_rule                TEXT,
        addons                   JSONB DEFAULT '[]',
        premium_waiver           TEXT,
        expires_at               TIMESTAMP NOT NULL,
        created_at               TIMESTAMP DEFAULT NOW(),
        updated_at               TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[Migration] ✅ Base table ready.");

    // Step 2: Add universal insurance columns (idempotent — IF NOT EXISTS)
    await client.query(`
      ALTER TABLE policy_analyses
        ADD COLUMN IF NOT EXISTS insurer                 TEXT,
        ADD COLUMN IF NOT EXISTS insured_items           JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS policy_specific_details JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS pre_existing_conditions TEXT,
        ADD COLUMN IF NOT EXISTS claim_process           TEXT,
        ADD COLUMN IF NOT EXISTS network_hospitals       TEXT,
        ADD COLUMN IF NOT EXISTS ncb_discount            TEXT,
        ADD COLUMN IF NOT EXISTS third_party_liability   DECIMAL(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS own_damage_limit        DECIMAL(14,2) DEFAULT 0;
    `);
    console.log("[Migration] ✅ Universal insurance columns added.");
    console.log("[Migration] ✅ Migration complete!");
  } catch (err) {
    console.error("[Migration] ❌ Failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
