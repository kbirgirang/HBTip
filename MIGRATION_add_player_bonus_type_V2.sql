-- =========================
-- Migration: Add 'player' back to bonus_type enum (V2 - Safe version)
-- =========================
-- Keyrðu þetta til að bæta við 'player' bonus type aftur

-- 1) Droppa constraints áður en við breytum type
alter table public.bonus_questions 
  drop constraint if exists bonus_questions_check;

alter table public.bonus_answers 
  drop constraint if exists bonus_answers_check;

-- 2) Búa til nýtt enum með 'player'
create type public.bonus_type_new as enum ('number', 'choice', 'player');

-- 3) Breyta gögnunum - fyrst í text
alter table public.bonus_questions 
  alter column type type text using type::text;

-- Síðan breytum við í nýja enum með explicit cast
alter table public.bonus_questions 
  alter column type type public.bonus_type_new using (type::text)::public.bonus_type_new;

-- 4) Endurnefnum enum
drop type if exists public.bonus_type;
alter type public.bonus_type_new rename to bonus_type;

-- 5) Bæta constraints aftur við (nú með player support)
alter table public.bonus_questions 
  add constraint bonus_questions_check check (
    (correct_number is null and correct_player_id is null and correct_choice is null)
    or
    (type = 'number'::public.bonus_type and correct_number is not null and correct_player_id is null and correct_choice is null)
    or
    (type = 'choice'::public.bonus_type and correct_choice is not null and correct_number is null and correct_player_id is null)
    or
    (type = 'player'::public.bonus_type and correct_player_id is not null and correct_number is null and correct_choice is null)
  );

alter table public.bonus_answers 
  add constraint bonus_answers_check check (
    (answer_number is null and answer_player_id is null and answer_choice is null)
    or
    (answer_number is not null and answer_player_id is null and answer_choice is null)
    or
    (answer_choice is not null and answer_number is null and answer_player_id is null)
    or
    (answer_player_id is not null and answer_number is null and answer_choice is null)
  );

notify pgrst, 'reload schema';

