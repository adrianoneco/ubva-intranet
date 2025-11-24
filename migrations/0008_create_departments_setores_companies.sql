-- Create normalized tables for departments, setores and companies
-- Add nullable FK columns to contacts and backfill from existing text columns

-- 1) create tables if missing
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS setores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2) add nullable fk columns to contacts if they don't exist
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department_id INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS setor_id INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id INTEGER;

-- 3) backfill distinct names into new tables (safe inserts)
INSERT INTO departments (name)
SELECT DISTINCT TRIM(department) FROM contacts WHERE department IS NOT NULL AND TRIM(department) <> ''
  AND NOT EXISTS (SELECT 1 FROM departments d WHERE d.name = TRIM(contacts.department));

INSERT INTO setores (name)
SELECT DISTINCT TRIM(setor) FROM contacts WHERE setor IS NOT NULL AND TRIM(setor) <> ''
  AND NOT EXISTS (SELECT 1 FROM setores s WHERE s.name = TRIM(contacts.setor));

INSERT INTO companies (name)
SELECT DISTINCT TRIM(company) FROM contacts WHERE company IS NOT NULL AND TRIM(company) <> ''
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.name = TRIM(contacts.company));

-- 4) populate fk columns by joining on name
UPDATE contacts
SET department_id = d.id
FROM departments d
WHERE TRIM(contacts.department) <> '' AND TRIM(contacts.department) = d.name;

UPDATE contacts
SET setor_id = s.id
FROM setores s
WHERE TRIM(contacts.setor) <> '' AND TRIM(contacts.setor) = s.name;

UPDATE contacts
SET company_id = c.id
FROM companies c
WHERE TRIM(contacts.company) <> '' AND TRIM(contacts.company) = c.name;

-- 5) add foreign key constraints if they are not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_department_id_fkey'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_setor_id_fkey'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_company_id_fkey'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 6) add indexes to speed joins
CREATE INDEX IF NOT EXISTS idx_contacts_department_id ON contacts(department_id);
CREATE INDEX IF NOT EXISTS idx_contacts_setor_id ON contacts(setor_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
