-- ============================================================
-- VaultLife Migration: 003_policies_and_reset
-- Tables: password_reset_tokens, policies
-- Run: psql -U vaultlife_user -d vaultlife_db -f 003_policies_and_reset.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- TABLE: password_reset_tokens
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT          NOT NULL,
  expires_at  TIMESTAMPTZ   NOT NULL,
  used        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);

-- ─────────────────────────────────────────────
-- ENUM: policy types and statuses
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE policy_type AS ENUM ('health','life','car','home','travel','term','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_status AS ENUM ('active','expired','expiring_soon','cancelled','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE premium_frequency AS ENUM ('monthly','quarterly','half_yearly','annually','one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- TABLE: policies
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policies (
  id                    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Core details
  policy_type           policy_type     NOT NULL DEFAULT 'health',
  policy_name           VARCHAR(200)    NOT NULL,
  insurer_name          VARCHAR(150)    NOT NULL,
  policy_number         VARCHAR(80),
  plan_name             VARCHAR(150),

  -- Coverage
  sum_insured           DECIMAL(15,2),
  coverage_details      TEXT,

  -- Premium
  premium_amount        DECIMAL(10,2),
  premium_frequency     premium_frequency DEFAULT 'annually',
  premium_due_date      DATE,

  -- Dates
  start_date            DATE,
  expiry_date           DATE,
  renewal_date          DATE,

  -- Status (computed + manual)
  status                policy_status   NOT NULL DEFAULT 'active',

  -- Vehicle specific
  vehicle_number        VARCHAR(20),
  vehicle_make_model    VARCHAR(100),

  -- Contact
  insurer_phone         VARCHAR(20),
  insurer_email         VARCHAR(255),
  agent_name            VARCHAR(120),
  agent_phone           VARCHAR(20),

  -- Notes
  notes                 TEXT,
  active                BOOLEAN         NOT NULL DEFAULT TRUE,

  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_user_id     ON policies(user_id);
CREATE INDEX IF NOT EXISTS idx_policies_type        ON policies(user_id, policy_type);
CREATE INDEX IF NOT EXISTS idx_policies_expiry      ON policies(user_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_policies_active      ON policies(user_id, active);

CREATE TRIGGER set_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- FUNCTION: auto-compute policy status
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_policy_status(exp_date DATE)
RETURNS policy_status AS $$
BEGIN
  IF exp_date IS NULL THEN RETURN 'active'; END IF;
  IF exp_date < CURRENT_DATE THEN RETURN 'expired'; END IF;
  IF exp_date <= CURRENT_DATE + INTERVAL '30 days' THEN RETURN 'expiring_soon'; END IF;
  RETURN 'active';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────
-- VIEW: policies with computed status
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW policies_with_status AS
SELECT
  p.*,
  compute_policy_status(p.expiry_date) AS computed_status,
  CASE
    WHEN p.expiry_date IS NOT NULL THEN (p.expiry_date - CURRENT_DATE)
    ELSE NULL
  END AS days_to_expiry
FROM policies p
WHERE p.active = TRUE;

SELECT 'Migration 003_policies_and_reset applied successfully' AS status;
