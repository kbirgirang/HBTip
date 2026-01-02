-- =========================
-- Migration: Add player_options JSONB field to bonus_questions
-- =========================
-- Keyrðu þetta til að bæta við player_options JSONB field

alter table public.bonus_questions 
  add column if not exists player_options jsonb null;

notify pgrst, 'reload schema';

