-- Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards (created_at);
CREATE INDEX IF NOT EXISTS idx_cards_schedule_start ON cards (schedule_start);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks (category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed);
-- contacts index exists (idx_contacts_kind) created previously
