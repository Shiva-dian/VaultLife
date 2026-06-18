-- ============================================================
-- VaultLife Migration 007: Master/Sub Table Architecture
-- + Centralized Document Storage
-- + File size constraints (2MB max)
-- ============================================================
-- Run: psql -U vaultlife_user -d vaultlife_db -f 007_master_sub_tables.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- SECTION 1: SPLIT users → user_auth + user_profile
-- ─────────────────────────────────────────────

-- user_auth: login credentials only (minimal, fast lookups)
CREATE TABLE IF NOT EXISTS user_auth (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  phone                 VARCHAR(15)  NOT NULL UNIQUE,
  password_hash         TEXT         NOT NULL,
  status                user_status  NOT NULL DEFAULT 'active',
  email_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  phone_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  preferred_otp_channel otp_channel  NOT NULL DEFAULT 'email',
  failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  last_login_ip         INET,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_auth_email  ON user_auth(email);
CREATE INDEX IF NOT EXISTS idx_user_auth_phone  ON user_auth(phone);
CREATE INDEX IF NOT EXISTS idx_user_auth_user_id ON user_auth(user_id);

-- Populate from existing users table
INSERT INTO user_auth (
  user_id, email, phone, password_hash, status,
  email_verified, phone_verified, preferred_otp_channel,
  failed_login_attempts, locked_until, last_login_at, last_login_ip,
  created_at, updated_at
)
SELECT id, email, phone, password_hash, status,
       email_verified, phone_verified, preferred_otp_channel,
       failed_login_attempts, locked_until, last_login_at, last_login_ip,
       created_at, updated_at
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- user_profile: all personal / KYC details
CREATE TABLE IF NOT EXISTS user_profile (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(120) NOT NULL,
  username        VARCHAR(80)  UNIQUE,
  avatar_url      TEXT,
  date_of_birth   DATE,
  gender          VARCHAR(10),
  occupation      VARCHAR(100),
  -- KYC
  aadhaar_last4   CHAR(4),
  aadhaar_verified BOOLEAN    NOT NULL DEFAULT FALSE,
  pan_number      VARCHAR(10),
  -- Address
  address_line1   TEXT,
  address_line2   TEXT,
  city            VARCHAR(80),
  state           VARCHAR(80),
  pincode         VARCHAR(10),
  country         VARCHAR(60)  NOT NULL DEFAULT 'India',
  -- Subscription
  plan_type       VARCHAR(20)  NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON user_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_pan     ON user_profile(pan_number);

-- Populate from existing users table
INSERT INTO user_profile (
  user_id, full_name, username, avatar_url, date_of_birth, occupation,
  aadhaar_last4, aadhaar_verified, pan_number,
  address_line1, address_line2, city, state, pincode,
  created_at, updated_at
)
SELECT id, full_name, username, avatar_url,
       CASE WHEN date_of_birth IS NOT NULL THEN date_of_birth::DATE ELSE NULL END,
       occupation, aadhaar_last4,
       COALESCE(aadhaar_verified, FALSE),
       pan_number, address_line1, address_line2, city, state, pincode,
       created_at, updated_at
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SECTION 2: CENTRALIZED DOCUMENTS TABLE
-- All modules store document references here
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE doc_module AS ENUM (
    'bank_account','investment','commodity','insurance_policy',
    'real_estate','liability','nominee','user_profile'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM (
    -- Bank
    'bank_statement','passbook','fixed_deposit_receipt','account_opening_form',
    -- Investment
    'demat_statement','mutual_fund_statement','holdings_report','contract_note',
    -- Commodity
    'purchase_invoice','valuation_certificate','assay_report','locker_receipt',
    -- Insurance
    'policy_document','premium_receipt','claim_form','endorsement',
    -- Real Estate
    'sale_deed','patta_copy','encumbrance_certificate','khata_extract',
    'registered_document','tax_receipt','building_plan','survey_sketch',
    'gps_image','property_photo',
    -- Liability
    'loan_agreement','repayment_schedule','noc','bank_statement_liability',
    -- General
    'aadhaar_copy','pan_copy','photo_id','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS vault_documents (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Which module and record this document belongs to
  module          doc_module   NOT NULL,
  record_id       UUID         NOT NULL,   -- FK to the parent record (bank_account id, policy id, etc.)
  doc_type        doc_type     NOT NULL DEFAULT 'other',
  doc_label       VARCHAR(200),            -- human-readable label e.g. "Sale Deed 2023"

  -- File metadata
  file_name       VARCHAR(255) NOT NULL,
  file_size_bytes INTEGER      NOT NULL,   -- stored in bytes; validated <= 2MB on insert
  mime_type       VARCHAR(100) NOT NULL,
  storage_path    TEXT         NOT NULL,   -- relative path: "documents/{user_id}/{module}/{uuid}.pdf"
  storage_url     TEXT,                    -- full URL after upload (S3 / Cloudinary / local)

  -- File integrity
  file_hash       VARCHAR(64),             -- SHA-256 of file contents

  -- Constraints: 2MB = 2 * 1024 * 1024 = 2,097,152 bytes
  CONSTRAINT chk_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 2097152),
  CONSTRAINT chk_mime_type CHECK (
    mime_type IN (
      'application/pdf',
      'image/jpeg','image/jpg','image/png','image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),

  -- Soft delete
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  notes           TEXT,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_user_id   ON vault_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_module    ON vault_documents(module, record_id);
CREATE INDEX IF NOT EXISTS idx_docs_record    ON vault_documents(record_id);
CREATE INDEX IF NOT EXISTS idx_docs_active    ON vault_documents(user_id, active);

CREATE TRIGGER set_vault_documents_updated_at
  BEFORE UPDATE ON vault_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- SECTION 3: SPLIT bank_accounts → master + details
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_account_master (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name       VARCHAR(120) NOT NULL,
  account_type    account_type NOT NULL DEFAULT 'savings',
  account_number_last4 CHAR(4),
  currency        CHAR(3)      NOT NULL DEFAULT 'INR',
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bam_user_id ON bank_account_master(user_id, active);

CREATE TABLE IF NOT EXISTS bank_account_details (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      UUID         NOT NULL UNIQUE REFERENCES bank_account_master(id) ON DELETE CASCADE,
  account_holder  VARCHAR(120),
  branch          VARCHAR(120),
  ifsc_code       VARCHAR(11),
  micr_code       VARCHAR(9),
  balance         DECIMAL(15,2) NOT NULL DEFAULT 0,
  interest_rate   DECIMAL(5,2),
  maturity_date   DATE,
  nominee_name    VARCHAR(120),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bad_account_id ON bank_account_details(account_id);

-- Migrate existing data
INSERT INTO bank_account_master (id, user_id, bank_name, account_type, account_number_last4, currency, active, sort_order, created_at, updated_at)
SELECT id, user_id, bank_name, account_type, account_number_last4, currency, active, sort_order, created_at, updated_at
FROM bank_accounts ON CONFLICT (id) DO NOTHING;

INSERT INTO bank_account_details (account_id, account_holder, branch, ifsc_code, balance, interest_rate, maturity_date, notes, created_at, updated_at)
SELECT id, account_holder, branch, ifsc_code, balance, interest_rate, maturity_date, notes, created_at, updated_at
FROM bank_accounts ON CONFLICT (account_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SECTION 4: SPLIT stock_investments → master + details
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investment_master (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_name   VARCHAR(120) NOT NULL,
  investment_type investment_type NOT NULL DEFAULT 'stocks',
  account_id_masked VARCHAR(30),
  currency        CHAR(3)      NOT NULL DEFAULT 'INR',
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_im_user_id ON investment_master(user_id, active);

CREATE TABLE IF NOT EXISTS investment_details (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id   UUID         NOT NULL UNIQUE REFERENCES investment_master(id) ON DELETE CASCADE,
  instrument_name VARCHAR(200),
  current_value   DECIMAL(15,2) NOT NULL DEFAULT 0,
  invested_amount DECIMAL(15,2),
  units           DECIMAL(14,4),
  avg_buy_price   DECIMAL(12,4),
  last_price      DECIMAL(12,4),
  as_of_date      DATE,
  nominee_name    VARCHAR(120),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_id_investment_id ON investment_details(investment_id);

INSERT INTO investment_master (id, user_id, platform_name, investment_type, account_id_masked, currency, active, sort_order, created_at, updated_at)
SELECT id, user_id, platform_name, investment_type, account_id_masked, currency, active, sort_order, created_at, updated_at
FROM stock_investments ON CONFLICT (id) DO NOTHING;

INSERT INTO investment_details (investment_id, instrument_name, current_value, invested_amount, units, avg_buy_price, notes, created_at, updated_at)
SELECT id, instrument_name, current_value, invested_amount, units, avg_buy_price, notes, created_at, updated_at
FROM stock_investments ON CONFLICT (investment_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SECTION 5: SPLIT insurance_policies → master + details
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policy_master (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_name     VARCHAR(200)      NOT NULL,
  insurer_name    VARCHAR(150)      NOT NULL,
  policy_number   VARCHAR(100),
  category        insurance_category NOT NULL,
  status          policy_status     NOT NULL DEFAULT 'active',
  active          BOOLEAN           NOT NULL DEFAULT TRUE,
  sort_order      INTEGER           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_user_id  ON policy_master(user_id, active);
CREATE INDEX IF NOT EXISTS idx_pm_category ON policy_master(user_id, category);

CREATE TABLE IF NOT EXISTS policy_details (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id           UUID         NOT NULL UNIQUE REFERENCES policy_master(id) ON DELETE CASCADE,
  sum_insured         DECIMAL(15,2),
  premium_amount      DECIMAL(10,2) NOT NULL,
  premium_frequency   premium_frequency NOT NULL DEFAULT 'annual',
  start_date          DATE,
  expiry_date         DATE          NOT NULL,
  renewal_date        DATE,
  next_premium_due    DATE,
  -- Vehicle
  vehicle_reg_number  VARCHAR(20),
  vehicle_make_model  VARCHAR(100),
  -- Property
  property_address    TEXT,
  -- People
  nominee_name        VARCHAR(120),
  agent_name          VARCHAR(120),
  agent_phone         VARCHAR(15),
  insurer_helpline    VARCHAR(20),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pd_policy_id  ON policy_details(policy_id);
CREATE INDEX IF NOT EXISTS idx_pd_expiry     ON policy_details(expiry_date);

INSERT INTO policy_master (id, user_id, policy_name, insurer_name, policy_number, category, status, active, sort_order, created_at, updated_at)
SELECT id, user_id, policy_name, insurer_name, policy_number, category,
       COALESCE(compute_policy_status(expiry_date), 'active'), active, sort_order, created_at, updated_at
FROM insurance_policies ON CONFLICT (id) DO NOTHING;

INSERT INTO policy_details (policy_id, sum_insured, premium_amount, premium_frequency, start_date, expiry_date, renewal_date, next_premium_due, vehicle_reg_number, vehicle_make_model, property_address, nominee_name, agent_name, agent_phone, insurer_helpline, notes, created_at, updated_at)
SELECT id, sum_insured, premium_amount, premium_frequency, start_date, expiry_date, renewal_date, next_premium_due, vehicle_reg_number, vehicle_make_model, property_address, nominee_name, agent_name, agent_phone, insurer_helpline, notes, created_at, updated_at
FROM insurance_policies ON CONFLICT (policy_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SECTION 6: SPLIT real_estate → master + details
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS real_estate_master (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_name   VARCHAR(200)  NOT NULL,
  property_type   property_type NOT NULL,
  district        VARCHAR(80)   NOT NULL,
  state           VARCHAR(80)   NOT NULL DEFAULT 'Tamil Nadu',
  active          BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order      INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rem_user_id ON real_estate_master(user_id, active);

CREATE TABLE IF NOT EXISTS real_estate_details (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           UUID         NOT NULL UNIQUE REFERENCES real_estate_master(id) ON DELETE CASCADE,
  -- Location
  door_flat_number      VARCHAR(50),
  street_address        TEXT,
  village_locality      VARCHAR(120),
  taluk                 VARCHAR(80),
  pincode               VARCHAR(10),
  -- Survey
  survey_number         VARCHAR(100),
  sub_division          VARCHAR(50),
  patta_number          VARCHAR(50),
  khata_number          VARCHAR(50),
  ward_block            VARCHAR(50),
  -- Area
  total_area            DECIMAL(14,4) NOT NULL,
  area_unit             area_unit     NOT NULL DEFAULT 'sqft',
  area_in_sqft          DECIMAL(14,4),
  uds_area              DECIMAL(14,4),
  built_up_area         DECIMAL(14,4),
  -- Registration
  registration_number   VARCHAR(100),
  registered_date       DATE,
  registration_office   VARCHAR(120),
  document_number       VARCHAR(100),
  -- Financial
  purchase_price        DECIMAL(15,2),
  current_market_value  DECIMAL(15,2),
  guideline_value       DECIMAL(15,2),
  stamp_duty_paid       DECIMAL(10,2),
  loan_outstanding      DECIMAL(15,2) DEFAULT 0,
  lender_name           VARCHAR(120),
  -- Title
  title_status          title_status  NOT NULL DEFAULT 'clear',
  ec_updated_date       DATE,
  tax_paid_upto         DATE,
  occupancy_status      VARCHAR(50),
  monthly_rental        DECIMAL(10,2),
  -- People
  co_owners             TEXT,
  nominee_name          VARCHAR(120),
  -- GPS
  gps_lat               DECIMAL(10,7),
  gps_lng               DECIMAL(10,7),
  gps_address           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_red_property_id ON real_estate_details(property_id);

INSERT INTO real_estate_master (id, user_id, property_name, property_type, district, state, active, sort_order, created_at, updated_at)
SELECT id, user_id, property_name, property_type, district, state, active, sort_order, created_at, updated_at
FROM real_estate ON CONFLICT (id) DO NOTHING;

INSERT INTO real_estate_details (
  property_id, door_flat_number, street_address, village_locality, taluk, pincode,
  survey_number, sub_division, patta_number, khata_number, ward_block,
  total_area, area_unit, area_in_sqft, uds_area, built_up_area,
  registration_number, registered_date, registration_office, document_number,
  purchase_price, current_market_value, guideline_value, stamp_duty_paid,
  loan_outstanding, lender_name, title_status, ec_updated_date, tax_paid_upto,
  occupancy_status, monthly_rental, co_owners, nominee_name,
  gps_lat, gps_lng, gps_address, notes, created_at, updated_at
)
SELECT id, door_flat_number, street_address, village_locality, taluk, pincode,
  survey_number, sub_division, patta_number, khata_number, ward_block,
  total_area, area_unit, area_in_sqft, uds_area, built_up_area,
  registration_number, registered_date, registration_office, document_number,
  purchase_price, current_market_value, guideline_value, stamp_duty_paid,
  COALESCE(loan_outstanding,0), lender_name, title_status, ec_updated_date, tax_paid_upto,
  occupancy_status, monthly_rental, co_owners, nominee_name,
  gps_lat, gps_lng, gps_address, notes, created_at, updated_at
FROM real_estate ON CONFLICT (property_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SECTION 7: SPLIT liabilities → master + details
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liability_master (
  id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction           liability_direction NOT NULL,
  liability_type      liability_type      NOT NULL,
  label               VARCHAR(200)        NOT NULL,
  counterparty_name   VARCHAR(120)        NOT NULL,
  is_settled          BOOLEAN             NOT NULL DEFAULT FALSE,
  active              BOOLEAN             NOT NULL DEFAULT TRUE,
  sort_order          INTEGER             NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_user_id   ON liability_master(user_id, active);
CREATE INDEX IF NOT EXISTS idx_lm_direction ON liability_master(user_id, direction);

CREATE TABLE IF NOT EXISTS liability_details (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  liability_id          UUID        NOT NULL UNIQUE REFERENCES liability_master(id) ON DELETE CASCADE,
  counterparty_phone    VARCHAR(15),
  counterparty_relation VARCHAR(80),
  principal_amount      DECIMAL(15,2) NOT NULL,
  outstanding_amount    DECIMAL(15,2) NOT NULL,
  interest_rate         DECIMAL(6,3),
  emi_amount            DECIMAL(10,2),
  start_date            DATE,
  due_date              DATE,
  next_payment_date     DATE,
  settled_date          DATE,
  repayment_frequency   repayment_frequency,
  loan_date             DATE,
  transaction_mode      transaction_mode DEFAULT 'bank_transfer',
  transaction_ref       VARCHAR(100),
  account_number_masked VARCHAR(30),
  loan_purpose          TEXT,
  collateral            TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ld_liability_id ON liability_details(liability_id);
CREATE INDEX IF NOT EXISTS idx_ld_due          ON liability_details(due_date);

INSERT INTO liability_master (id, user_id, direction, liability_type, label, counterparty_name, is_settled, active, sort_order, created_at, updated_at)
SELECT id, user_id, direction, liability_type, label, counterparty_name, is_settled, active, sort_order, created_at, updated_at
FROM liabilities ON CONFLICT (id) DO NOTHING;

INSERT INTO liability_details (
  liability_id, counterparty_phone, counterparty_relation,
  principal_amount, outstanding_amount, interest_rate, emi_amount,
  start_date, due_date, next_payment_date, settled_date, repayment_frequency,
  loan_date, transaction_mode, transaction_ref,
  account_number_masked, loan_purpose, collateral, notes, created_at, updated_at
)
SELECT id, counterparty_phone, counterparty_relation,
  principal_amount, outstanding_amount, interest_rate, emi_amount,
  start_date, due_date, next_payment_date, settled_date, repayment_frequency,
  loan_date, transaction_mode, transaction_ref,
  account_number_masked, loan_purpose, collateral, notes, created_at, updated_at
FROM liabilities ON CONFLICT (liability_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SECTION 8: SPLIT nominees → master + details
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nominee_master (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(120) NOT NULL,
  relationship    nominee_relationship NOT NULL,
  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
  share_percent   DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (share_percent >= 0 AND share_percent <= 100),
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nom_master_user ON nominee_master(user_id, active);

CREATE TABLE IF NOT EXISTS nominee_details (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nominee_id      UUID        NOT NULL UNIQUE REFERENCES nominee_master(id) ON DELETE CASCADE,
  email           VARCHAR(255),
  phone           VARCHAR(15),
  date_of_birth   DATE,
  aadhaar_last4   CHAR(4),
  pan_number      VARCHAR(10),
  address         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nom_details_id ON nominee_details(nominee_id);

INSERT INTO nominee_master (id, user_id, full_name, relationship, is_primary, share_percent, active, created_at, updated_at)
SELECT id, user_id, full_name, relationship, is_primary, share_percent, active, created_at, updated_at
FROM nominees ON CONFLICT (id) DO NOTHING;

INSERT INTO nominee_details (nominee_id, email, phone, date_of_birth, aadhaar_last4, pan_number, address, notes, created_at, updated_at)
SELECT id, email, phone, date_of_birth, aadhaar_last4, pan_number, address, notes, created_at, updated_at
FROM nominees ON CONFLICT (nominee_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SECTION 9: CONVENIENCE VIEWS
-- (replaces direct table queries in controllers)
-- ─────────────────────────────────────────────

-- Full user view
CREATE OR REPLACE VIEW v_users AS
SELECT
  u.id, u.created_at AS registered_at,
  ua.email, ua.phone, ua.status, ua.email_verified, ua.phone_verified,
  ua.preferred_otp_channel, ua.failed_login_attempts, ua.locked_until,
  ua.last_login_at, ua.last_login_ip,
  up.full_name, up.username, up.avatar_url, up.date_of_birth, up.gender,
  up.occupation, up.aadhaar_last4, up.aadhaar_verified, up.pan_number,
  up.address_line1, up.address_line2, up.city, up.state, up.pincode, up.country,
  up.plan_type, up.plan_expires_at
FROM users u
JOIN user_auth    ua ON ua.user_id = u.id
JOIN user_profile up ON up.user_id = u.id;

-- Full bank accounts view
CREATE OR REPLACE VIEW v_bank_accounts AS
SELECT
  bm.id, bm.user_id, bm.bank_name, bm.account_type, bm.account_number_last4, bm.currency,
  bm.active, bm.sort_order, bm.created_at, bm.updated_at,
  bd.account_holder, bd.branch, bd.ifsc_code, bd.micr_code,
  bd.balance, bd.interest_rate, bd.maturity_date, bd.nominee_name, bd.notes
FROM bank_account_master bm
JOIN bank_account_details bd ON bd.account_id = bm.id;

-- Full investments view
CREATE OR REPLACE VIEW v_investments AS
SELECT
  im.id, im.user_id, im.platform_name, im.investment_type, im.account_id_masked, im.currency,
  im.active, im.sort_order, im.created_at, im.updated_at,
  id2.instrument_name, id2.current_value, id2.invested_amount, id2.units,
  id2.avg_buy_price, id2.last_price, id2.as_of_date, id2.nominee_name, id2.notes
FROM investment_master im
JOIN investment_details id2 ON id2.investment_id = im.id;

-- Full policies view with live computed status
CREATE OR REPLACE VIEW v_policies AS
SELECT
  pm.id, pm.user_id, pm.policy_name, pm.insurer_name, pm.policy_number, pm.category,
  pm.active, pm.sort_order, pm.created_at, pm.updated_at,
  pd.sum_insured, pd.premium_amount, pd.premium_frequency,
  pd.start_date, pd.expiry_date, pd.renewal_date, pd.next_premium_due,
  pd.vehicle_reg_number, pd.vehicle_make_model, pd.property_address,
  pd.nominee_name, pd.agent_name, pd.agent_phone, pd.insurer_helpline, pd.notes,
  compute_policy_status(pd.expiry_date)    AS computed_status,
  (pd.expiry_date - CURRENT_DATE)          AS days_to_expiry
FROM policy_master pm
JOIN policy_details pd ON pd.policy_id = pm.id;

-- Full real estate view
CREATE OR REPLACE VIEW v_real_estate AS
SELECT
  rem.id, rem.user_id, rem.property_name, rem.property_type, rem.district, rem.state,
  rem.active, rem.sort_order, rem.created_at, rem.updated_at,
  red.*
FROM real_estate_master rem
JOIN real_estate_details red ON red.property_id = rem.id;

-- Full liabilities view
CREATE OR REPLACE VIEW v_liabilities AS
SELECT
  lm.id, lm.user_id, lm.direction, lm.liability_type, lm.label,
  lm.counterparty_name, lm.is_settled, lm.active, lm.sort_order,
  lm.created_at, lm.updated_at,
  ld.*
FROM liability_master lm
JOIN liability_details ld ON ld.liability_id = lm.id;

-- Full nominees view
CREATE OR REPLACE VIEW v_nominees AS
SELECT
  nm.id, nm.user_id, nm.full_name, nm.relationship, nm.is_primary,
  nm.share_percent, nm.active, nm.created_at, nm.updated_at,
  nd.email, nd.phone, nd.date_of_birth, nd.aadhaar_last4, nd.pan_number, nd.address, nd.notes
FROM nominee_master nm
JOIN nominee_details nd ON nd.nominee_id = nm.id;

-- Documents with module context
CREATE OR REPLACE VIEW v_documents AS
SELECT
  vd.*,
  CASE vd.module
    WHEN 'bank_account'      THEN (SELECT bank_name FROM bank_account_master WHERE id = vd.record_id)
    WHEN 'investment'        THEN (SELECT platform_name FROM investment_master WHERE id = vd.record_id)
    WHEN 'insurance_policy'  THEN (SELECT policy_name FROM policy_master WHERE id = vd.record_id)
    WHEN 'real_estate'       THEN (SELECT property_name FROM real_estate_master WHERE id = vd.record_id)
    WHEN 'liability'         THEN (SELECT label FROM liability_master WHERE id = vd.record_id)
    WHEN 'nominee'           THEN (SELECT full_name FROM nominee_master WHERE id = vd.record_id)
    ELSE 'Unknown'
  END AS record_label
FROM vault_documents vd;

-- ─────────────────────────────────────────────
-- SECTION 10: DOCUMENT STORAGE FUNCTION
-- Validates file before inserting
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION store_document(
  p_user_id       UUID,
  p_module        doc_module,
  p_record_id     UUID,
  p_doc_type      doc_type,
  p_doc_label     VARCHAR,
  p_file_name     VARCHAR,
  p_file_size     INTEGER,
  p_mime_type     VARCHAR,
  p_storage_path  TEXT,
  p_storage_url   TEXT DEFAULT NULL,
  p_file_hash     VARCHAR DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS vault_documents AS $$
DECLARE
  v_doc vault_documents;
  v_max_size CONSTANT INTEGER := 2097152; -- 2MB
BEGIN
  -- File size check
  IF p_file_size > v_max_size THEN
    RAISE EXCEPTION 'File too large: % bytes. Maximum allowed is 2MB (% bytes).', p_file_size, v_max_size;
  END IF;
  IF p_file_size <= 0 THEN
    RAISE EXCEPTION 'Invalid file size: %', p_file_size;
  END IF;
  -- MIME type check
  IF p_mime_type NOT IN (
    'application/pdf','image/jpeg','image/jpg','image/png','image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) THEN
    RAISE EXCEPTION 'Unsupported file type: %. Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX', p_mime_type;
  END IF;

  INSERT INTO vault_documents (
    user_id, module, record_id, doc_type, doc_label,
    file_name, file_size_bytes, mime_type, storage_path, storage_url, file_hash, notes
  ) VALUES (
    p_user_id, p_module, p_record_id, p_doc_type, p_doc_label,
    p_file_name, p_file_size, p_mime_type, p_storage_path, p_storage_url, p_file_hash, p_notes
  ) RETURNING * INTO v_doc;

  RETURN v_doc;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- SECTION 11: UPDATED vault_dashboard_summary
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW vault_dashboard_summary AS
SELECT
  u.id                                                              AS user_id,
  COALESCE(b.total_bank_balance, 0)                                 AS total_bank_balance,
  COALESCE(b.bank_account_count, 0)                                 AS bank_account_count,
  COALESCE(s.total_investment_value, 0)                             AS total_investment_value,
  COALESCE(s.investment_count, 0)                                   AS investment_count,
  COALESCE(c.total_commodity_value, 0)                              AS total_commodity_value,
  COALESCE(c.commodity_count, 0)                                    AS commodity_count,
  COALESCE(re.total_property_value, 0)                              AS total_property_value,
  COALESCE(re.property_count, 0)                                    AS property_count,
  COALESCE(lb.total_borrowed, 0)                                    AS total_borrowed,
  COALESCE(lb.total_lent, 0)                                        AS total_lent,
  COALESCE(n.nominee_count, 0)                                      AS nominee_count,
  COALESCE(d.document_count, 0)                                     AS document_count,
  -- Net worth formula
  COALESCE(b.total_bank_balance, 0) +
    COALESCE(s.total_investment_value, 0) +
    COALESCE(c.total_commodity_value, 0) +
    COALESCE(re.total_property_value, 0) -
    COALESCE(lb.total_borrowed, 0)                                  AS total_wealth
FROM users u
LEFT JOIN (
  SELECT bm.user_id, SUM(bd.balance) AS total_bank_balance, COUNT(*) AS bank_account_count
  FROM bank_account_master bm JOIN bank_account_details bd ON bd.account_id = bm.id
  WHERE bm.active = TRUE GROUP BY bm.user_id
) b ON b.user_id = u.id
LEFT JOIN (
  SELECT im.user_id, SUM(id2.current_value) AS total_investment_value, COUNT(*) AS investment_count
  FROM investment_master im JOIN investment_details id2 ON id2.investment_id = im.id
  WHERE im.active = TRUE GROUP BY im.user_id
) s ON s.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(current_value) AS total_commodity_value, COUNT(*) AS commodity_count
  FROM commodities WHERE active = TRUE GROUP BY user_id
) c ON c.user_id = u.id
LEFT JOIN (
  SELECT rem.user_id, SUM(red.current_market_value) AS total_property_value, COUNT(*) AS property_count
  FROM real_estate_master rem JOIN real_estate_details red ON red.property_id = rem.id
  WHERE rem.active = TRUE GROUP BY rem.user_id
) re ON re.user_id = u.id
LEFT JOIN (
  SELECT lm.user_id,
    SUM(CASE WHEN lm.direction='borrowed' AND NOT lm.is_settled THEN ld.outstanding_amount ELSE 0 END) AS total_borrowed,
    SUM(CASE WHEN lm.direction='lent'     AND NOT lm.is_settled THEN ld.outstanding_amount ELSE 0 END) AS total_lent
  FROM liability_master lm JOIN liability_details ld ON ld.liability_id = lm.id
  WHERE lm.active = TRUE GROUP BY lm.user_id
) lb ON lb.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS nominee_count
  FROM nominee_master WHERE active = TRUE GROUP BY user_id
) n ON n.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS document_count
  FROM vault_documents WHERE active = TRUE GROUP BY user_id
) d ON d.user_id = u.id;

-- ─────────────────────────────────────────────
-- SECTION 12: DOCUMENT STATS VIEW
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_document_stats AS
SELECT
  user_id,
  COUNT(*)                                    AS total_documents,
  SUM(file_size_bytes)                        AS total_size_bytes,
  ROUND(SUM(file_size_bytes)::NUMERIC / 1048576, 2) AS total_size_mb,
  COUNT(*) FILTER (WHERE module='bank_account')     AS bank_docs,
  COUNT(*) FILTER (WHERE module='investment')       AS investment_docs,
  COUNT(*) FILTER (WHERE module='insurance_policy') AS policy_docs,
  COUNT(*) FILTER (WHERE module='real_estate')      AS property_docs,
  COUNT(*) FILTER (WHERE module='liability')        AS liability_docs,
  COUNT(*) FILTER (WHERE module='commodity')        AS commodity_docs
FROM vault_documents
WHERE active = TRUE
GROUP BY user_id;

SELECT 'Migration 007 — Master/Sub table architecture applied successfully' AS status;
