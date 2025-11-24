-- 0001_create_cards_table.sql

CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  image text,
  schedule_start timestamptz,
  schedule_end timestamptz,
  schedule_weekdays text,
  created_at timestamptz NOT NULL DEFAULT now()
);
