-- BillScan initial schema
-- Safe to run multiple times (all statements are idempotent)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Admins ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL DEFAULT '',
  email         TEXT,
  phone         TEXT,
  whatsapp_id   TEXT        UNIQUE,
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp_id ON customers (whatsapp_id);

-- ── Bills ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID        REFERENCES customers(id) ON DELETE SET NULL,
  store_name      TEXT        NOT NULL DEFAULT '',
  store_address   TEXT,
  date            DATE,
  time            TIME,
  bill_number     TEXT,
  subtotal        NUMERIC(12,2),
  tax             NUMERIC(12,2),
  discount        NUMERIC(12,2),
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        CHAR(3)     NOT NULL DEFAULT 'USD',
  payment_method  TEXT,
  image_base64    TEXT,
  image_mime_type TEXT,
  source          TEXT        NOT NULL DEFAULT 'web',
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills (customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_date        ON bills (date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_scanned_at  ON bills (scanned_at DESC);

-- ── Bill Items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     UUID          NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL DEFAULT '',
  brand       TEXT,
  category    TEXT          NOT NULL DEFAULT 'Other',
  quantity    NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit        TEXT,
  unit_price  NUMERIC(12,2),
  price       NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_brand   ON bill_items (brand);

-- ── Auto-update customers.updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Default admin ─────────────────────────────────────────────────────────────
-- Password is 'changeme' — REPLACE HASH IMMEDIATELY after first deploy:
--   node -e "require('bcrypt').hash('YourPassword',12).then(console.log)"
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/o5XwC1pKi')
ON CONFLICT (username) DO NOTHING;
