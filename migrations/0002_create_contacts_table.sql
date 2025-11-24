-- Create contacts table to persist contacts from /contacts sync
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  name TEXT NOT NULL,
  number TEXT,
  department TEXT,
  setor TEXT,
  image TEXT,
  rocket_user TEXT,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_kind ON contacts(kind);
