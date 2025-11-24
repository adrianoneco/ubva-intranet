-- Add display_name, email and permissions to users and create groups table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS permissions text;

-- Create groups table to store role definitions and their permissions
CREATE TABLE IF NOT EXISTS groups (
  id varchar(64) PRIMARY KEY,
  name text NOT NULL UNIQUE,
  permissions text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Seed default groups (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = 'admin') THEN
    INSERT INTO groups (id, name, permissions) VALUES ('admin', 'Admin', '["agendamento:create","agendamento:edit","agendamento:delete","users:manage","calendar:view","calendar:create","calendar:edit","calendar:delete"]');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = 'editor') THEN
    INSERT INTO groups (id, name, permissions) VALUES ('editor', 'Editor', '["agendamento:create","agendamento:edit","calendar:view","calendar:create","calendar:edit"]');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = 'viewer') THEN
    INSERT INTO groups (id, name, permissions) VALUES ('viewer', 'Viewer', '[]');
  END IF;
END$$;
