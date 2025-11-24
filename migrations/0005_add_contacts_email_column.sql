-- Add email column to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT;
