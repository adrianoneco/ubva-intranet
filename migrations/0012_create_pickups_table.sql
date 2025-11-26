-- Migration: Create pickups table for agendamentos
CREATE TABLE IF NOT EXISTS pickups (
  id VARCHAR(255) PRIMARY KEY,
  date VARCHAR(10) NOT NULL,
  time VARCHAR(5),
  status VARCHAR(20) DEFAULT 'agendado',
  client_id VARCHAR(255) NOT NULL,
  client_name TEXT,
  order_id TEXT,
  user_id INTEGER,
  user_display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  scheduled_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pickups_date ON pickups(date);
CREATE INDEX IF NOT EXISTS idx_pickups_user_id ON pickups(user_id);
CREATE INDEX IF NOT EXISTS idx_pickups_status ON pickups(status);
CREATE INDEX IF NOT EXISTS idx_pickups_scheduled_at ON pickups(scheduled_at);
