-- migration: create users table
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username varchar(64) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  salt text NOT NULL,
  iterations integer NOT NULL DEFAULT 100000,
  role varchar(32) NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
