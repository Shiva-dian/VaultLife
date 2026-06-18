-- ============================================================
-- VaultLife Migration: 004_aadhaar
-- Adds Aadhaar (encrypted, last-4 visible) to users + nominees
-- Run ONCE: psql -U vaultlife_user -d vaultlife_db -f 004_aadhaar.sql
-- ============================================================

-- Add Aadhaar to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS aadhaar_last4   CHAR(4),
  ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pan_number       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS date_of_birth    DATE,
  ADD COLUMN IF NOT EXISTS occupation       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_line1    TEXT,
  ADD COLUMN IF NOT EXISTS address_line2    TEXT,
  ADD COLUMN IF NOT EXISTS city             VARCHAR(80),
  ADD COLUMN IF NOT EXISTS state            VARCHAR(80),
  ADD COLUMN IF NOT EXISTS pincode          VARCHAR(10);

-- Add Aadhaar to nominees table
ALTER TABLE nominees
  ADD COLUMN IF NOT EXISTS aadhaar_last4    CHAR(4),
  ADD COLUMN IF NOT EXISTS pan_number       VARCHAR(10);

-- Index for Aadhaar lookup (last 4 digits only stored)
CREATE INDEX IF NOT EXISTS idx_users_aadhaar ON users(aadhaar_last4);

SELECT 'Migration 004_aadhaar applied successfully' AS status;
