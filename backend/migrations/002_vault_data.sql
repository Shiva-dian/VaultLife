-- ============================================================
-- VaultLife Migration: 002_vault_data
-- Tables: nominees, bank_accounts, stock_investments
-- Run: psql -U vaultlife_user -d vaultlife_db -f 002_vault_data.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE nominee_relationship AS ENUM (
    'spouse','son','daughter','father','mother',
    'brother','sister','friend','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM (
    'savings','current','salary','fixed_deposit','recurring_deposit','ppf','nps','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE investment_type AS ENUM (
    'stocks','mutual_fund','etf','bonds','crypto','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- TABLE: nominees
-- Max 10 per user (enforced in app layer)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nominees (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  full_name       VARCHAR(120)  NOT NULL,
  relationship    nominee_relationship NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(15),
  date_of_birth   DATE,
  address         TEXT,
  share_percent   DECIMAL(5,2)  NOT NULL DEFAULT 0
                  CHECK (share_percent >= 0 AND share_percent <= 100),
  is_primary      BOOLEAN       NOT NULL DEFAULT FALSE,
  notes           TEXT,
  active          BOOLEAN       NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nominees_user_id ON nominees(user_id);
CREATE INDEX IF NOT EXISTS idx_nominees_active  ON nominees(user_id, active);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_nominees_updated_at
  BEFORE UPDATE ON nominees
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- TABLE: bank_accounts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  bank_name       VARCHAR(120)  NOT NULL,
  account_type    account_type  NOT NULL DEFAULT 'savings',
  account_number_last4 CHAR(4),          -- only last 4 digits stored
  account_holder  VARCHAR(120),
  branch          VARCHAR(120),
  ifsc_code       VARCHAR(11),
  balance         DECIMAL(15,2) NOT NULL DEFAULT 0,
  interest_rate   DECIMAL(5,2),          -- for FD/RD/PPF
  maturity_date   DATE,                  -- for FD/RD
  currency        CHAR(3)       NOT NULL DEFAULT 'INR',
  notes           TEXT,
  active          BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order      INTEGER       NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active  ON bank_accounts(user_id, active);

CREATE TRIGGER set_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- TABLE: stock_investments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_investments (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  platform_name       VARCHAR(120)  NOT NULL,   -- e.g. Zerodha, Groww, Angel
  investment_type     investment_type NOT NULL DEFAULT 'stocks',
  account_id_masked   VARCHAR(30),              -- masked demat/folio number
  instrument_name     VARCHAR(200),             -- stock/fund name (optional)
  current_value       DECIMAL(15,2) NOT NULL DEFAULT 0,
  invested_amount     DECIMAL(15,2),            -- original invested amount
  units               DECIMAL(14,4),            -- for MF units
  avg_buy_price       DECIMAL(12,4),
  currency            CHAR(3)       NOT NULL DEFAULT 'INR',
  notes               TEXT,
  active              BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INTEGER       NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_investments_user_id ON stock_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_investments_active  ON stock_investments(user_id, active);

CREATE TRIGGER set_stock_investments_updated_at
  BEFORE UPDATE ON stock_investments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- VIEWS: dashboard summary
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW vault_dashboard_summary AS
SELECT
  u.id                                                    AS user_id,
  COALESCE(b.total_bank_balance, 0)                       AS total_bank_balance,
  COALESCE(b.bank_account_count, 0)                       AS bank_account_count,
  COALESCE(s.total_investment_value, 0)                   AS total_investment_value,
  COALESCE(s.investment_count, 0)                         AS investment_count,
  COALESCE(b.total_bank_balance, 0) +
    COALESCE(s.total_investment_value, 0)                 AS total_wealth,
  COALESCE(n.nominee_count, 0)                            AS nominee_count
FROM users u
LEFT JOIN (
  SELECT user_id,
    SUM(balance)                AS total_bank_balance,
    COUNT(*)                    AS bank_account_count
  FROM bank_accounts WHERE active = TRUE
  GROUP BY user_id
) b ON b.user_id = u.id
LEFT JOIN (
  SELECT user_id,
    SUM(current_value)          AS total_investment_value,
    COUNT(*)                    AS investment_count
  FROM stock_investments WHERE active = TRUE
  GROUP BY user_id
) s ON s.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS nominee_count
  FROM nominees WHERE active = TRUE
  GROUP BY user_id
) n ON n.user_id = u.id;

SELECT 'Migration 002_vault_data applied successfully' AS status;
