-- ============================================================
-- VaultLife Migration 008: Cleanup — Drop Old Flat Tables
-- Run AFTER migration 007 has been applied and verified.
-- This removes all duplicate/redundant tables and old views.
-- ============================================================

-- ─────────────────────────────────────────────
-- STEP 1: Safety check — verify new tables have data
-- before dropping anything
-- ─────────────────────────────────────────────
DO $$
DECLARE
  v_bam   INTEGER; v_im INTEGER; v_pm INTEGER;
  v_rem   INTEGER; v_lm INTEGER; v_nm INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bam FROM bank_account_master;
  SELECT COUNT(*) INTO v_im  FROM investment_master;
  SELECT COUNT(*) INTO v_pm  FROM policy_master;
  SELECT COUNT(*) INTO v_rem FROM real_estate_master;
  SELECT COUNT(*) INTO v_lm  FROM liability_master;
  SELECT COUNT(*) INTO v_nm  FROM nominee_master;

  RAISE NOTICE 'Master table counts — bank: %, invest: %, policy: %, re: %, liab: %, nominee: %',
    v_bam, v_im, v_pm, v_rem, v_lm, v_nm;
END;
$$;

-- ─────────────────────────────────────────────
-- STEP 2: Drop old views that are replaced
-- ─────────────────────────────────────────────
DROP VIEW IF EXISTS policies_with_status;
DROP VIEW IF EXISTS user_summary;

-- ─────────────────────────────────────────────
-- STEP 3: Rebuild vault_dashboard_summary to use
-- only the new master/detail tables
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
  -- Net worth
  COALESCE(b.total_bank_balance, 0) +
    COALESCE(s.total_investment_value, 0) +
    COALESCE(c.total_commodity_value, 0) +
    COALESCE(re.total_property_value, 0) -
    COALESCE(lb.total_borrowed, 0)                                  AS total_wealth
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
    SUM(id2.current_value)  AS total_investment_value,
    COUNT(im.id)            AS investment_count
  FROM investment_master im
  JOIN investment_details id2 ON id2.investment_id = im.id
  WHERE im.active = TRUE
  GROUP BY im.user_id
) s ON s.user_id = u.id
LEFT JOIN (
  SELECT user_id,
    SUM(current_value) AS total_commodity_value,
    COUNT(*)           AS commodity_count
  FROM commodities WHERE active = TRUE
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
  FROM nominee_master WHERE active = TRUE
  GROUP BY user_id
) n ON n.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS document_count
  FROM vault_documents WHERE active = TRUE
  GROUP BY user_id
) d ON d.user_id = u.id;

-- ─────────────────────────────────────────────
-- STEP 4: Drop old flat tables
-- CASCADE handles any remaining FK references
-- ─────────────────────────────────────────────

-- Drop bank_accounts (replaced by bank_account_master + bank_account_details)
DROP TABLE IF EXISTS bank_accounts CASCADE;

-- Drop stock_investments (replaced by investment_master + investment_details)
DROP TABLE IF EXISTS stock_investments CASCADE;

-- Drop insurance_policies (replaced by policy_master + policy_details)
DROP TABLE IF EXISTS insurance_policies CASCADE;

-- Drop real_estate (replaced by real_estate_master + real_estate_details)
DROP TABLE IF EXISTS real_estate CASCADE;

-- Drop liabilities (replaced by liability_master + liability_details)
DROP TABLE IF EXISTS liabilities CASCADE;

-- Drop nominees (replaced by nominee_master + nominee_details)
DROP TABLE IF EXISTS nominees CASCADE;

-- Drop subscription_plans (now handled in user_profile.plan_type)
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- ─────────────────────────────────────────────
-- STEP 5: Verify final table list
-- ─────────────────────────────────────────────
DO $$
DECLARE
  tbl_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO tbl_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
  RAISE NOTICE 'Total base tables remaining: %', tbl_count;
END;
$$;

-- ─────────────────────────────────────────────
-- STEP 6: Add useful indexes missed earlier
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bad_balance   ON bank_account_details(balance);
CREATE INDEX IF NOT EXISTS idx_id2_cur_val   ON investment_details(current_value);
CREATE INDEX IF NOT EXISTS idx_pd_expiry2    ON policy_details(expiry_date);
CREATE INDEX IF NOT EXISTS idx_ld_due2       ON liability_details(due_date);
CREATE INDEX IF NOT EXISTS idx_red_cur_mkt   ON real_estate_details(current_market_value);
CREATE INDEX IF NOT EXISTS idx_docs_type     ON vault_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_docs_created  ON vault_documents(user_id, created_at DESC);

-- ─────────────────────────────────────────────
-- STEP 7: Add check constraints for data quality
-- ─────────────────────────────────────────────
ALTER TABLE bank_account_details
  ADD CONSTRAINT IF NOT EXISTS chk_balance_non_negative CHECK (balance >= 0);

ALTER TABLE investment_details
  ADD CONSTRAINT IF NOT EXISTS chk_current_value_nn CHECK (current_value >= 0);

ALTER TABLE policy_details
  ADD CONSTRAINT IF NOT EXISTS chk_premium_positive CHECK (premium_amount > 0);

ALTER TABLE liability_details
  ADD CONSTRAINT IF NOT EXISTS chk_outstanding_nn CHECK (outstanding_amount >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_principal_positive CHECK (principal_amount > 0);

ALTER TABLE real_estate_details
  ADD CONSTRAINT IF NOT EXISTS chk_area_positive CHECK (total_area > 0);

-- ─────────────────────────────────────────────
-- STEP 8: Final canonical table list comment
-- ─────────────────────────────────────────────
COMMENT ON TABLE users                  IS 'Core user identity — UUID primary key only';
COMMENT ON TABLE user_auth              IS 'Login credentials: email, phone, password hash, OTP channel';
COMMENT ON TABLE user_profile           IS 'Personal details: name, DOB, Aadhaar, address, plan';
COMMENT ON TABLE otp_tokens             IS 'One-time passwords for login, registration, password reset';
COMMENT ON TABLE refresh_tokens         IS 'JWT refresh tokens for session management';
COMMENT ON TABLE password_reset_tokens  IS 'Bcrypt-hashed tokens for 3-step password reset';
COMMENT ON TABLE audit_log              IS 'Security audit trail: logins, logouts, changes';
COMMENT ON TABLE bank_account_master    IS 'Bank identity: name, type, last 4 digits';
COMMENT ON TABLE bank_account_details   IS 'Bank financials: balance, IFSC, branch, interest rate';
COMMENT ON TABLE investment_master      IS 'Investment platform identity: name, type, demat account';
COMMENT ON TABLE investment_details     IS 'Investment values: current price, units, P&L, NAV';
COMMENT ON TABLE policy_master          IS 'Insurance identity: policy name, insurer, category';
COMMENT ON TABLE policy_details         IS 'Insurance details: premium, dates, vehicle, agent';
COMMENT ON TABLE real_estate_master     IS 'Property identity: name, type, district, state';
COMMENT ON TABLE real_estate_details    IS 'Property details: survey, area, registration, GPS, financials';
COMMENT ON TABLE liability_master       IS 'Liability identity: direction, type, counterparty';
COMMENT ON TABLE liability_details      IS 'Liability financials: amounts, dates, EMI, collateral';
COMMENT ON TABLE nominee_master         IS 'Nominee identity: name, relationship, share percentage';
COMMENT ON TABLE nominee_details        IS 'Nominee contact: phone, email, DOB, Aadhaar';
COMMENT ON TABLE commodities            IS 'Physical assets: gold, jewels, bonds, certificates';
COMMENT ON TABLE vault_documents        IS 'Centralized document store for all modules (max 2MB each)';

SELECT 'Migration 008 — Cleanup complete. Old flat tables removed.' AS status;

-- ─────────────────────────────────────────────
-- FINAL CANONICAL TABLE LIST (24 tables + views)
-- ─────────────────────────────────────────────
-- BASE TABLES (should be exactly these):
--   users, user_auth, user_profile
--   otp_tokens, refresh_tokens, password_reset_tokens, audit_log
--   bank_account_master, bank_account_details
--   investment_master, investment_details
--   policy_master, policy_details
--   real_estate_master, real_estate_details
--   liability_master, liability_details
--   nominee_master, nominee_details
--   commodities
--   vault_documents
-- VIEWS:
--   vault_dashboard_summary
--   v_users, v_bank_accounts, v_investments
--   v_policies, v_real_estate, v_liabilities
--   v_nominees, v_documents, v_document_stats
-- ─────────────────────────────────────────────
