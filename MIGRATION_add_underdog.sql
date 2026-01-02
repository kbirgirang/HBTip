-- =========================
-- Migration: Add underdog feature to matches
-- =========================
-- Keyrðu þetta til að bæta við underdog eiginleika

-- Bæta við underdog reitum á matches töfluna
alter table public.matches
  add column underdog_team char(1) null check (underdog_team in ('1','2')),
  add column underdog_multiplier numeric(3,1) null check (underdog_multiplier is null or underdog_multiplier >= 1.0);

-- Athuga: Ef underdog_team er sett, þá verður underdog_multiplier líka að vera sett (en þetta er ekki enforced í DB)
-- Admin UI verður að tryggja að bæði séu sett eða bæði séu null

notify pgrst, 'reload schema';

