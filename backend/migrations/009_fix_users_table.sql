-- ============================================================
-- VaultLife Migration 009: Fix users table + missing views
-- ============================================================
-- Issues fixed:
-- 1. users table still has full_name, email, phone, password_hash etc.
--    → Strip it down to UUID + timestamps only (identity anchor)
-- 2. v_liabilities and v_real_estate views missing
-- 3. vault_dashboard_summary missing from views
-- 4. subscription_plans table still exists (data moved to user_profile)
-- ============================================================

-- ─────────────────────────────────────────────
-- STEP 1: Verify user_auth and user_profile
-- are fully populated before we touch users
-- ─────────────────────────────────────────────
DO $$
DECLARE
  v_users    INTEGER;
  v_auth     INTEGER;
  v_profile  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users   FROM users;
  SELECT COUNT(*) INTO v_auth    FROM user_auth;
  SELECT COUNT(*) INTO v_profile FROM user_profile;

  IF v_auth < v_users THEN
    RAISE EXCEPTION
      'SAFETY ABORT: user_auth has % rows but users has %. Run migration 007 first.',
      v_auth, v_users;
  END IF;
  IF v_profile < v_users THEN
    RAISE EXCEPTION
      'SAFETY ABORT: user_profile has % rows but users has %. Run migration 007 first.',
      v_profile, v_users;
  END IF;

  RAISE NOTICE 'Safety check passed: % users, % auth rows, % profile rows',
    v_users, v_auth, v_profile;
END;
$$;

-- ─────────────────────────────────────────────
-- STEP 2: Drop the old user_summary view
-- (references columns we're about to remove)
-- ─────────────────────────────────────────────
DROP VIEW IF EXISTS user_summary CASCADE;
DROP VIEW IF EXISTS v_users CASCADE;

-- ─────────────────────────────────────────────
-- STEP 3: Strip users table to identity only
-- Remove all columns now in user_auth / user_profile
-- Keep: id, created_at, updated_at
-- ─────────────────────────────────────────────
ALTER TABLE users
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS phone_verified,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS preferred_otp_channel,
  DROP COLUMN IF EXISTS failed_login_attempts,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS last_login_ip,
  -- columns added by migration 004
  DROP COLUMN IF EXISTS aadhaar_last4,
  DROP COLUMN IF EXISTS aadhaar_verified,
  DROP COLUMN IF EXISTS pan_number,
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS occupation,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS pincode;

-- Add a comment explaining the lean design
COMMENT ON TABLE users IS
  'Identity anchor — UUID only. All credentials in user_auth. All profile data in user_profile.';

-- ─────────────────────────────────────────────
-- STEP 4: Drop old indexes on users that
-- referenced columns we just removed
-- ─────────────────────────────────────────────
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_phone;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_status;

-- ─────────────────────────────────────────────
-- STEP 5: Drop subscription_plans table
-- Plan data now lives in user_profile.plan_type
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- ─────────────────────────────────────────────
-- STEP 6: Recreate v_users using clean join
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_users AS
SELECT
  u.id,
  u.created_at                   AS registered_at,
  u.updated_at,
  -- Auth
  ua.email,
  ua.phone,
  ua.status,
  ua.email_verified,
  ua.phone_verified,
  ua.preferred_otp_channel,
  ua.failed_login_attempts,
  ua.locked_until,
  ua.last_login_at,
  ua.last_login_ip,
  -- Profile
  up.full_name,
  up.username,
  up.avatar_url,
  up.date_of_birth,
  up.gender,
  up.occupation,
  up.aadhaar_last4,
  up.aadhaar_verified,
  up.pan_number,
  up.address_line1,
  up.address_line2,
  up.city,
  up.state,
  up.pincode,
  up.country,
  up.plan_type,
  up.plan_expires_at
FROM users u
JOIN user_auth    ua ON ua.user_id = u.id
JOIN user_profile up ON up.user_id = u.id;

-- ─────────────────────────────────────────────
-- STEP 7: Add missing views
-- v_real_estate, v_liabilities
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_real_estate AS
SELECT
  rem.id,
  rem.user_id,
  rem.property_name,
  rem.property_type,
  rem.district,
  rem.state,
  rem.active,
  rem.sort_order,
  rem.created_at,
  rem.updated_at,
  -- Detail columns
  red.door_flat_number,
  red.street_address,
  red.village_locality,
  red.taluk,
  red.pincode,
  red.survey_number,
  red.sub_division,
  red.patta_number,
  red.khata_number,
  red.ward_block,
  red.total_area,
  red.area_unit,
  red.area_in_sqft,
  red.uds_area,
  red.built_up_area,
  red.registration_number,
  red.registered_date,
  red.registration_office,
  red.document_number,
  red.purchase_price,
  red.current_market_value,
  red.guideline_value,
  red.stamp_duty_paid,
  red.loan_outstanding,
  red.lender_name,
  red.title_status,
  red.ec_updated_date,
  red.tax_paid_upto,
  red.occupancy_status,
  red.monthly_rental,
  red.co_owners,
  red.nominee_name,
  red.gps_lat,
  red.gps_lng,
  red.gps_address,
  red.notes
FROM real_estate_master rem
JOIN real_estate_details red ON red.property_id = rem.id;

CREATE OR REPLACE VIEW v_liabilities AS
SELECT
  lm.id,
  lm.user_id,
  lm.direction,
  lm.liability_type,
  lm.label,
  lm.counterparty_name,
  lm.is_settled,
  lm.active,
  lm.sort_order,
  lm.created_at,
  lm.updated_at,
  -- Detail columns
  ld.counterparty_phone,
  ld.counterparty_relation,
  ld.principal_amount,
  ld.outstanding_amount,
  ld.interest_rate,
  ld.emi_amount,
  ld.start_date,
  ld.due_date,
  ld.next_payment_date,
  ld.settled_date,
  ld.repayment_frequency,
  ld.loan_date,
  ld.transaction_mode,
  ld.transaction_ref,
  ld.account_number_masked,
  ld.loan_purpose,
  ld.collateral,
  ld.notes
FROM liability_master lm
JOIN liability_details ld ON ld.liability_id = lm.id;

-- ─────────────────────────────────────────────
-- STEP 8: Ensure vault_dashboard_summary view
-- is correct and uses all new tables
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
  COALESCE(b.total_bank_balance, 0)
    + COALESCE(s.total_investment_value, 0)
    + COALESCE(c.total_commodity_value, 0)
    + COALESCE(re.total_property_value, 0)
    - COALESCE(lb.total_borrowed, 0)                                AS total_wealth
FROM users u
LEFT JOIN (
  SELECT bm.user_id,
    SUM(bd.balance)  AS total_bank_balance,
    COUNT(bm.id)     AS bank_account_count
  FROM bank_account_master bm
  JOIN bank_account_details bd ON bd.account_id = bm.id
  WHERE bm.active = TRUE
  GROUP BY bm.user_id
) b ON b.user_id = u.id
LEFT JOIN (
  SELECT im.user_id,
    SUM(id2.current_value) AS total_investment_value,
    COUNT(im.id)           AS investment_count
  FROM investment_master im
  JOIN investment_details id2 ON id2.investment_id = im.id
  WHERE im.active = TRUE
  GROUP BY im.user_id
) s ON s.user_id = u.id
LEFT JOIN (
  SELECT user_id,
    SUM(current_value) AS total_commodity_value,
    COUNT(*)           AS commodity_count
  FROM commodities
  WHERE active = TRUE
  GROUP BY user_id
) c ON c.user_id = u.id
LEFT JOIN (
  SELECT rem.user_id,
    SUM(red.current_market_value) AS total_property_value,
    COUNT(rem.id)                 AS property_count
  FROM real_estate_master rem
  JOIN real_estate_details red ON red.property_id = rem.id
  WHERE rem.active = TRUE
  GROUP BY rem.user_id
) re ON re.user_id = u.id
LEFT JOIN (
  SELECT lm.user_id,
    SUM(CASE WHEN lm.direction = 'borrowed' AND NOT lm.is_settled
             THEN ld.outstanding_amount ELSE 0 END) AS total_borrowed,
    SUM(CASE WHEN lm.direction = 'lent'     AND NOT lm.is_settled
             THEN ld.outstanding_amount ELSE 0 END) AS total_lent
  FROM liability_master lm
  JOIN liability_details ld ON ld.liability_id = lm.id
  WHERE lm.active = TRUE
  GROUP BY lm.user_id
) lb ON lb.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS nominee_count
  FROM nominee_master
  WHERE active = TRUE
  GROUP BY user_id
) n ON n.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS document_count
  FROM vault_documents
  WHERE active = TRUE
  GROUP BY user_id
) d ON d.user_id = u.id;

-- ─────────────────────────────────────────────
-- STEP 9: Update trigger to only fire on
-- remaining columns
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- STEP 10: Final verification — show all tables
-- ─────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  tbl_count INTEGER := 0;
  view_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== FINAL TABLE LIST ===';
  FOR rec IN
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_type, table_name
  LOOP
    IF rec.table_type = 'BASE TABLE' THEN
      tbl_count := tbl_count + 1;
      RAISE NOTICE '  TABLE: %', rec.table_name;
    ELSE
      view_count := view_count + 1;
      RAISE NOTICE '  VIEW:  %', rec.table_name;
    END IF;
  END LOOP;
  RAISE NOTICE '=== TOTAL: % tables, % views ===', tbl_count, view_count;
END;
$$;

SELECT 'Migration 009 complete — users table cleaned, all views created' AS status;

-- ─────────────────────────────────────────────
-- EXPECTED FINAL STATE
-- ─────────────────────────────────────────────
-- BASE TABLES (21):
--   users                    ← UUID + timestamps only
--   user_auth                ← email, phone, password, OTP, sessions
--   user_profile             ← name, DOB, Aadhaar, PAN, address, plan
--   otp_tokens
--   refresh_tokens
--   password_reset_tokens
--   audit_log
--   bank_account_master      ← bank name, type, last 4
--   bank_account_details     ← balance, IFSC, branch
--   investment_master        ← platform name, type
--   investment_details       ← values, P&L, units
--   policy_master            ← policy name, insurer, category
--   policy_details           ← premium, dates, vehicle, agent
--   real_estate_master       ← property name, type, location
--   real_estate_details      ← survey, area, registration, GPS
--   liability_master         ← direction, type, counterparty
--   liability_details        ← amounts, dates, EMI
--   nominee_master           ← name, relationship, share%
--   nominee_details          ← contact, DOB, Aadhaar
--   commodities              ← gold, jewels, bonds
--   vault_documents          ← all module documents (max 2MB)
--
-- VIEWS (10):
--   vault_dashboard_summary
--   v_users
--   v_bank_accounts
--   v_investments
--   v_policies
--   v_real_estate            ← was missing, now added
--   v_liabilities            ← was missing, now added
--   v_nominees
--   v_documents
--   v_document_stats
-- ─────────────────────────────────────────────
