-- Migration: Add oe_number column to pickups table
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS oe_number TEXT;
