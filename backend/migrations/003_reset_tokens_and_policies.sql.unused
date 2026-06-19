-- ============================================================
-- VaultLife Migration: 003_reset_tokens_and_policies
-- Tables: password_reset_tokens, insurance_policies
-- Run ONCE: psql -U vaultlife_user -d vaultlife_db -f 003_reset_tokens_and_policies.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- TABLE: password_reset_tokens
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT          NOT NULL,
  expires_at      TIMESTAMPTZ   NOT NULL,
  used            BOOLEAN       NOT NULL DEFAULT FALSE,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_tokens(token_hash);

-- ─────────────────────────────────────────────
-- ENUM: insurance_category, policy_status
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE insurance_category AS ENUM ('health','life','car','home','travel','bike','term','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_status AS ENUM ('active','expired','expiring_soon','cancelled','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE premium_frequency AS ENUM ('monthly','quarterly','half_yearly','annual','single');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- TABLE: insurance_policies
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_policies (
  id                    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic info
  policy_name           VARCHAR(200)    NOT NULL,
  insurer_name          VARCHAR(150)    NOT NULL,
  policy_number         VARCHAR(100),
  category              insurance_category NOT NULL,

  -- Coverage
  sum_insured           DECIMAL(15,2),
  premium_amount        DECIMAL(10,2)   NOT NULL,
  premium_frequency     premium_frequency NOT NULL DEFAULT 'annual',

  -- Dates
  start_date            DATE,
  expiry_date           DATE            NOT NULL,
  renewal_date          DATE,           -- computed or manual
  next_premium_due      DATE,

  -- Vehicle specific
  vehicle_reg_number    VARCHAR(20),
  vehicle_make_model    VARCHAR(100),

  -- Property specific
  property_address      TEXT,

  -- Nominees / beneficiaries
  nominee_name          VARCHAR(120),

  -- Contact
  agent_name            VARCHAR(120),
  agent_phone           VARCHAR(15),
  insurer_helpline      VARCHAR(20),

  -- Documents / notes
  notes                 TEXT,
  document_url          TEXT,

  -- Status (computed on fetch but also stored for quick filtering)
  status                policy_status   NOT NULL DEFAULT 'active',
  active                BOOLEAN         NOT NULL DEFAULT TRUE,
  sort_order            INTEGER         NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_user_id    ON insurance_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_policies_category   ON insurance_policies(user_id, category);
CREATE INDEX IF NOT EXISTS idx_policies_expiry     ON insurance_policies(expiry_date);
CREATE INDEX IF NOT EXISTS idx_policies_active     ON insurance_policies(user_id, active);

CREATE TRIGGER set_policies_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- FUNCTION: compute policy status
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_policy_status(expiry DATE)
RETURNS policy_status AS $$
BEGIN
  IF expiry < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF expiry <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'expiring_soon';
  ELSE
    RETURN 'active';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────
-- VIEW: policies_with_status (live status)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW policies_with_status AS
SELECT *,
  compute_policy_status(expiry_date) AS computed_status,
  (expiry_date - CURRENT_DATE)       AS days_to_expiry
FROM insurance_policies
WHERE active = TRUE;

SELECT 'Migration 003 applied successfully' AS status;
