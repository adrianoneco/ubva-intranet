-- Add company column to contacts and make it NOT NULL with default empty string for existing rows
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '';
ALTER TABLE contacts ALTER COLUMN company SET NOT NULL;
