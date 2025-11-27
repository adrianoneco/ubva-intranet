-- Migration: Add cancel_reason column to pickups table
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
