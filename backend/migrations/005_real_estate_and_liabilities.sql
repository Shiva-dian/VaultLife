-- ============================================================
-- VaultLife Migration: 005_real_estate_and_liabilities
-- Tables: real_estate, liabilities
-- Run ONCE: psql -U vaultlife_user -d vaultlife_db -f 005_real_estate_and_liabilities.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE property_type AS ENUM (
    'agricultural_land','residential_plot','residential_house','apartment',
    'commercial_land','commercial_building','industrial','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE area_unit AS ENUM ('cents','sqft','sqm','acres','grounds','guntas','perches','hectares');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE title_status AS ENUM ('clear','encumbered','disputed','under_verification','mortgaged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE liability_type AS ENUM (
    'home_loan','personal_loan','vehicle_loan','gold_loan','education_loan',
    'credit_card','borrowed_from_family','lent_to_family','lent_to_friend',
    'borrowed_from_friend','business_loan','mortgage','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE liability_direction AS ENUM ('borrowed','lent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE repayment_frequency AS ENUM ('monthly','quarterly','half_yearly','annual','bullet','on_demand');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- TABLE: real_estate
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS real_estate (
  id                    UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Property identification
  property_name         VARCHAR(200)      NOT NULL,
  property_type         property_type     NOT NULL,

  -- Location
  door_flat_number      VARCHAR(50),
  street_address        TEXT,
  village_locality      VARCHAR(120),
  taluk                 VARCHAR(80),
  district              VARCHAR(80)       NOT NULL,
  state                 VARCHAR(80)       NOT NULL DEFAULT 'Tamil Nadu',
  pincode               VARCHAR(10),
  latitude              DECIMAL(9,6),
  longitude             DECIMAL(9,6),

  -- Land survey details
  survey_number         VARCHAR(100),     -- e.g. "124/2A"
  sub_division          VARCHAR(50),      -- e.g. "B"
  patta_number          VARCHAR(50),      -- Patta / Khata number
  khata_number          VARCHAR(50),
  ward_block            VARCHAR(50),

  -- Area details
  total_area            DECIMAL(14,4)     NOT NULL,
  area_unit             area_unit         NOT NULL DEFAULT 'sqft',
  -- Derived areas stored for convenience
  area_in_sqft          DECIMAL(14,4),    -- computed on insert/update
  uds_area              DECIMAL(14,4),    -- Undivided share (for apartments)
  built_up_area         DECIMAL(14,4),    -- for house/apartments

  -- Registration / Legal
  registration_number   VARCHAR(100),
  registered_date       DATE,
  registration_office   VARCHAR(120),
  document_number       VARCHAR(100),     -- Sale deed / document number

  -- Financial
  purchase_price        DECIMAL(15,2),
  current_market_value  DECIMAL(15,2),
  guideline_value       DECIMAL(15,2),    -- Govt guideline value
  stamp_duty_paid       DECIMAL(10,2),
  loan_outstanding      DECIMAL(15,2)     DEFAULT 0,
  lender_name           VARCHAR(120),

  -- Title & Status
  title_status          title_status      NOT NULL DEFAULT 'clear',
  ec_updated_date       DATE,             -- Encumbrance Certificate date
  tax_paid_upto         DATE,             -- Property tax paid up to
  occupancy_status      VARCHAR(50),      -- 'own_use', 'rented', 'vacant'
  monthly_rental        DECIMAL(10,2),

  -- People
  co_owners             TEXT,             -- comma-separated names
  nominee_name          VARCHAR(120),

  -- Notes
  notes                 TEXT,
  active                BOOLEAN           NOT NULL DEFAULT TRUE,
  sort_order            INTEGER           NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_user_id  ON real_estate(user_id);
CREATE INDEX IF NOT EXISTS idx_re_active   ON real_estate(user_id, active);
CREATE INDEX IF NOT EXISTS idx_re_district ON real_estate(district);

CREATE TRIGGER set_real_estate_updated_at
  BEFORE UPDATE ON real_estate
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- TABLE: liabilities
-- Tracks money borrowed OR lent
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liabilities (
  id                    UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Direction & Type
  direction             liability_direction NOT NULL,  -- 'borrowed' or 'lent'
  liability_type        liability_type    NOT NULL,
  label                 VARCHAR(200)      NOT NULL,    -- e.g. "Home Loan — SBI", "Lent to Ravi"

  -- Counterparty
  counterparty_name     VARCHAR(120)      NOT NULL,   -- Bank name / person name
  counterparty_phone    VARCHAR(15),
  counterparty_relation VARCHAR(80),                  -- "Friend", "SBI Bank", etc.

  -- Amounts
  principal_amount      DECIMAL(15,2)     NOT NULL,   -- Original amount
  outstanding_amount    DECIMAL(15,2)     NOT NULL,   -- Current balance
  interest_rate         DECIMAL(6,3),                 -- % p.a.
  emi_amount            DECIMAL(10,2),

  -- Dates
  start_date            DATE,
  due_date              DATE,                          -- Final repayment date
  next_payment_date     DATE,
  repayment_frequency   repayment_frequency,

  -- Loan details
  account_number_masked VARCHAR(30),
  loan_purpose          TEXT,
  collateral            TEXT,                          -- what's kept as security

  -- Status
  is_settled            BOOLEAN           NOT NULL DEFAULT FALSE,
  settled_date          DATE,

  notes                 TEXT,
  active                BOOLEAN           NOT NULL DEFAULT TRUE,
  sort_order            INTEGER           NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liab_user_id   ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_liab_active    ON liabilities(user_id, active);
CREATE INDEX IF NOT EXISTS idx_liab_direction ON liabilities(user_id, direction);
CREATE INDEX IF NOT EXISTS idx_liab_due       ON liabilities(due_date);

CREATE TRIGGER set_liabilities_updated_at
  BEFORE UPDATE ON liabilities
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- Update vault_dashboard_summary view to include RE & liabilities
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW vault_dashboard_summary AS
SELECT
  u.id                                                          AS user_id,
  COALESCE(b.total_bank_balance, 0)                             AS total_bank_balance,
  COALESCE(b.bank_account_count, 0)                             AS bank_account_count,
  COALESCE(s.total_investment_value, 0)                         AS total_investment_value,
  COALESCE(s.investment_count, 0)                               AS investment_count,
  COALESCE(re.total_property_value, 0)                          AS total_property_value,
  COALESCE(re.property_count, 0)                                AS property_count,
  COALESCE(lb.total_borrowed, 0)                                AS total_borrowed,
  COALESCE(lb.total_lent, 0)                                    AS total_lent,
  -- Net worth = banks + investments + real estate - borrowed
  COALESCE(b.total_bank_balance, 0) +
    COALESCE(s.total_investment_value, 0) +
    COALESCE(re.total_property_value, 0) -
    COALESCE(lb.total_borrowed, 0)                              AS total_wealth,
  COALESCE(n.nominee_count, 0)                                  AS nominee_count
FROM users u
LEFT JOIN (
  SELECT user_id, SUM(balance) AS total_bank_balance, COUNT(*) AS bank_account_count
  FROM bank_accounts WHERE active = TRUE GROUP BY user_id
) b ON b.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(current_value) AS total_investment_value, COUNT(*) AS investment_count
  FROM stock_investments WHERE active = TRUE GROUP BY user_id
) s ON s.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(current_market_value) AS total_property_value, COUNT(*) AS property_count
  FROM real_estate WHERE active = TRUE GROUP BY user_id
) re ON re.user_id = u.id
LEFT JOIN (
  SELECT user_id,
    SUM(CASE WHEN direction='borrowed' THEN outstanding_amount ELSE 0 END) AS total_borrowed,
    SUM(CASE WHEN direction='lent'     THEN outstanding_amount ELSE 0 END) AS total_lent
  FROM liabilities WHERE active = TRUE AND is_settled = FALSE GROUP BY user_id
) lb ON lb.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS nominee_count FROM nominees WHERE active = TRUE GROUP BY user_id
) n ON n.user_id = u.id;

SELECT 'Migration 005_real_estate_and_liabilities applied successfully' AS status;
