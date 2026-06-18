-- Migration 006: document fields + gps on real_estate + loan_date/txn_mode on liabilities + commodities table

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS document_url TEXT, ADD COLUMN IF NOT EXISTS document_name VARCHAR(200);
ALTER TABLE stock_investments ADD COLUMN IF NOT EXISTS document_url TEXT, ADD COLUMN IF NOT EXISTS document_name VARCHAR(200);
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS document_name VARCHAR(200);
ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7), ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7), ADD COLUMN IF NOT EXISTS gps_address TEXT, ADD COLUMN IF NOT EXISTS gps_image_url TEXT, ADD COLUMN IF NOT EXISTS document_url TEXT, ADD COLUMN IF NOT EXISTS document_name VARCHAR(200);

DO $$ BEGIN CREATE TYPE transaction_mode AS ENUM ('cash','bank_transfer','upi','cheque','dd','online','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS loan_date DATE, ADD COLUMN IF NOT EXISTS transaction_mode transaction_mode DEFAULT 'bank_transfer', ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100), ADD COLUMN IF NOT EXISTS document_url TEXT, ADD COLUMN IF NOT EXISTS document_name VARCHAR(200);

DO $$ BEGIN CREATE TYPE commodity_type AS ENUM ('gold_coins','gold_bars','gold_jewellery','silver_coins','silver_bars','silver_jewellery','platinum','diamond','gemstones','physical_bonds','savings_certificate','nsc','kisan_vikas_patra','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE weight_unit AS ENUM ('grams','kilograms','tolas','ounces','milligrams'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS commodities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commodity_type commodity_type NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  weight DECIMAL(12,4), weight_unit weight_unit,
  purity VARCHAR(20), quantity INTEGER,
  purchase_price DECIMAL(15,2), current_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  purchase_date DATE, storage_location VARCHAR(200),
  insurance_policy_no VARCHAR(100), certificate_number VARCHAR(100),
  maturity_date DATE, face_value DECIMAL(15,2), interest_rate DECIMAL(6,3),
  document_url TEXT, document_name VARCHAR(200),
  notes TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commodities_user ON commodities(user_id, active);
CREATE TRIGGER set_commodities_updated_at BEFORE UPDATE ON commodities FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE VIEW vault_dashboard_summary AS
SELECT u.id AS user_id,
  COALESCE(b.total_bank_balance,0) AS total_bank_balance, COALESCE(b.bank_account_count,0) AS bank_account_count,
  COALESCE(s.total_investment_value,0) AS total_investment_value, COALESCE(s.investment_count,0) AS investment_count,
  COALESCE(c.total_commodity_value,0) AS total_commodity_value, COALESCE(c.commodity_count,0) AS commodity_count,
  COALESCE(re.total_property_value,0) AS total_property_value, COALESCE(re.property_count,0) AS property_count,
  COALESCE(lb.total_borrowed,0) AS total_borrowed, COALESCE(lb.total_lent,0) AS total_lent,
  COALESCE(b.total_bank_balance,0)+COALESCE(s.total_investment_value,0)+COALESCE(c.total_commodity_value,0)+COALESCE(re.total_property_value,0)-COALESCE(lb.total_borrowed,0) AS total_wealth,
  COALESCE(n.nominee_count,0) AS nominee_count
FROM users u
LEFT JOIN (SELECT user_id,SUM(balance) AS total_bank_balance,COUNT(*) AS bank_account_count FROM bank_accounts WHERE active=TRUE GROUP BY user_id) b ON b.user_id=u.id
LEFT JOIN (SELECT user_id,SUM(current_value) AS total_investment_value,COUNT(*) AS investment_count FROM stock_investments WHERE active=TRUE GROUP BY user_id) s ON s.user_id=u.id
LEFT JOIN (SELECT user_id,SUM(current_value) AS total_commodity_value,COUNT(*) AS commodity_count FROM commodities WHERE active=TRUE GROUP BY user_id) c ON c.user_id=u.id
LEFT JOIN (SELECT user_id,SUM(current_market_value) AS total_property_value,COUNT(*) AS property_count FROM real_estate WHERE active=TRUE GROUP BY user_id) re ON re.user_id=u.id
LEFT JOIN (SELECT user_id,SUM(CASE WHEN direction='borrowed' THEN outstanding_amount ELSE 0 END) AS total_borrowed,SUM(CASE WHEN direction='lent' THEN outstanding_amount ELSE 0 END) AS total_lent FROM liabilities WHERE active=TRUE AND is_settled=FALSE GROUP BY user_id) lb ON lb.user_id=u.id
LEFT JOIN (SELECT user_id,COUNT(*) AS nominee_count FROM nominees WHERE active=TRUE GROUP BY user_id) n ON n.user_id=u.id;

SELECT 'Migration 006 applied' AS status;
