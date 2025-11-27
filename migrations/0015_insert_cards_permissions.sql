-- Migration: Insert cards permissions
INSERT INTO permissions(key, description) VALUES 
  ('cards:view', 'Ver Cards'),
  ('cards:create', 'Criar Cards'),
  ('cards:edit', 'Editar Cards'),
  ('cards:delete', 'Apagar Cards')
ON CONFLICT (key) DO NOTHING;
