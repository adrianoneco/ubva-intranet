-- Consolidated contacts table creation (idempotent)
-- Ensures columns: department, setor, company and email (nullable)
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  name TEXT NOT NULL,
  number TEXT,
  department TEXT,
  setor TEXT,
  company TEXT DEFAULT '',
  image TEXT,
  rocket_user TEXT,
  whatsapp TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure indexes and column defaults/constraints are present without breaking existing data
CREATE INDEX IF NOT EXISTS idx_contacts_kind ON contacts(kind);

-- Make sure company is not null for new rows, but do not alter existing rows to avoid migration failures
ALTER TABLE contacts ALTER COLUMN company SET DEFAULT '';
