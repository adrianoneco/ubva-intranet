-- Migration 0011: create permissions table and group_permissions mapping
BEGIN;

-- create a permissions registry
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT
);

-- add created_at for compatibility with Drizzle schema
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();

-- mapping table between groups and permissions
CREATE TABLE IF NOT EXISTS group_permissions (
  group_id VARCHAR(64) NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (group_id, permission_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- add created_at for compatibility with Drizzle schema
ALTER TABLE group_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();

-- migrate distinct permissions from existing groups.permissions JSON column (if present)
-- groups.permissions may be stored as text containing a JSON array
DO $$
DECLARE
  rec RECORD;
  perm TEXT;
BEGIN
  FOR rec IN SELECT id, permissions FROM groups WHERE permissions IS NOT NULL AND trim(permissions) <> '' LOOP
    BEGIN
      FOR perm IN SELECT jsonb_array_elements_text(rec.permissions::jsonb) LOOP
        -- insert permission if not exists
        INSERT INTO permissions(key) VALUES (perm) ON CONFLICT (key) DO NOTHING;
      END LOOP;
    EXCEPTION WHEN others THEN
      -- ignore invalid JSON in groups.permissions
      RAISE NOTICE 'Skipping group % due to invalid permissions JSON', rec.id;
    END;
  END LOOP;

  -- populate group_permissions mapping
  FOR rec IN SELECT id, permissions FROM groups WHERE permissions IS NOT NULL AND trim(permissions) <> '' LOOP
    BEGIN
      FOR perm IN SELECT jsonb_array_elements_text(rec.permissions::jsonb) LOOP
        INSERT INTO group_permissions(group_id, permission_id)
        SELECT rec.id, p.id FROM permissions p WHERE p.key = perm
        ON CONFLICT (group_id, permission_id) DO NOTHING;
      END LOOP;
    EXCEPTION WHEN others THEN
      -- ignore invalid JSON
    END;
  END LOOP;
END$$;

-- remove per-user permissions column (migrate to role + group_permissions)
ALTER TABLE users DROP COLUMN IF EXISTS permissions;

COMMIT;
