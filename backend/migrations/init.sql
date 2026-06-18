-- ============================================================
-- VaultLife Database Schema
-- Migration: 001_init
-- Description: Users, OTP tokens, refresh tokens, audit log
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
CREATE TYPE otp_channel AS ENUM ('email', 'sms');
CREATE TYPE otp_purpose AS ENUM ('login', 'registration', 'password_reset', 'emergency');
CREATE TYPE audit_action AS ENUM (
  'register', 'login_attempt', 'login_success', 'login_failed',
  'otp_sent', 'otp_verified', 'otp_failed',
  'logout', 'token_refresh', 'password_change',
  'account_locked', 'account_unlocked'
);

-- ─────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name           VARCHAR(120)        NOT NULL,
  email               VARCHAR(255)        NOT NULL UNIQUE,
  phone               VARCHAR(15)         NOT NULL UNIQUE,
  username            VARCHAR(80)         UNIQUE,
  password_hash       TEXT                NOT NULL,
  
  -- Status & verification
  status              user_status         NOT NULL DEFAULT 'pending_verification',
  email_verified      BOOLEAN             NOT NULL DEFAULT FALSE,
  phone_verified      BOOLEAN             NOT NULL DEFAULT FALSE,
  
  -- Profile extras
  avatar_url          TEXT,
  preferred_otp_channel  otp_channel      NOT NULL DEFAULT 'email',
  
  -- Security
  failed_login_attempts   INTEGER         NOT NULL DEFAULT 0,
  locked_until            TIMESTAMPTZ,
  last_login_at           TIMESTAMPTZ,
  last_login_ip           INET,
  
  -- Timestamps
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_users_email   ON users (email);
CREATE INDEX idx_users_phone   ON users (phone);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_status  ON users (status);

-- ─────────────────────────────────────────────
-- TABLE: otp_tokens
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID            REFERENCES users(id) ON DELETE CASCADE,
  
  -- For pre-user (registration) OTPs, store identifier directly
  identifier      VARCHAR(255)    NOT NULL,  -- email or phone
  channel         otp_channel     NOT NULL,
  purpose         otp_purpose     NOT NULL,
  
  -- OTP stored as bcrypt hash
  otp_hash        TEXT            NOT NULL,
  
  -- Lifecycle
  expires_at      TIMESTAMPTZ     NOT NULL,
  used            BOOLEAN         NOT NULL DEFAULT FALSE,
  used_at         TIMESTAMPTZ,
  attempts        INTEGER         NOT NULL DEFAULT 0,
  max_attempts    INTEGER         NOT NULL DEFAULT 3,
  
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_identifier ON otp_tokens (identifier, purpose);
CREATE INDEX idx_otp_user_id    ON otp_tokens (user_id);
CREATE INDEX idx_otp_expires    ON otp_tokens (expires_at);

-- ─────────────────────────────────────────────
-- TABLE: refresh_tokens
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT            NOT NULL UNIQUE,
  device_info     TEXT,
  ip_address      INET,
  expires_at      TIMESTAMPTZ     NOT NULL,
  revoked         BOOLEAN         NOT NULL DEFAULT FALSE,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_user_id  ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_token    ON refresh_tokens (token_hash);

-- ─────────────────────────────────────────────
-- TABLE: audit_log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID            REFERENCES users(id) ON DELETE SET NULL,
  identifier      VARCHAR(255),   -- email/phone used in the attempt
  action          audit_action    NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id   ON audit_log (user_id);
CREATE INDEX idx_audit_action    ON audit_log (action);
CREATE INDEX idx_audit_created   ON audit_log (created_at);

-- ─────────────────────────────────────────────
-- FUNCTION: auto-update updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- FUNCTION: clean expired OTPs (call via cron)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM otp_tokens
  WHERE expires_at < NOW() OR used = TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- SEED: subscription plans (for reference)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(60)     NOT NULL UNIQUE,
  price_monthly   DECIMAL(8,2)    NOT NULL,
  price_annual    DECIMAL(8,2)    NOT NULL,
  features        JSONB,
  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_plans (name, price_monthly, price_annual, features) VALUES
  ('Solo Vault',   99.00,  999.00,  '{"max_nominees": 3, "max_bank_accounts": 5, "whatsapp": false, "priority_support": false}'),
  ('Family Vault', 299.00, 1999.00, '{"max_nominees": 10, "max_bank_accounts": null, "whatsapp": true, "priority_support": true}')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW user_summary AS
SELECT
  u.id,
  u.full_name,
  u.email,
  u.phone,
  u.username,
  u.status,
  u.email_verified,
  u.phone_verified,
  u.preferred_otp_channel,
  u.last_login_at,
  u.created_at,
  COUNT(rt.id) FILTER (WHERE rt.revoked = FALSE AND rt.expires_at > NOW()) AS active_sessions
FROM users u
LEFT JOIN refresh_tokens rt ON rt.user_id = u.id
GROUP BY u.id;

-- Done
SELECT 'VaultLife schema initialised successfully' AS status;
