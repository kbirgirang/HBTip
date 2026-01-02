-- =========================
-- Migration: Add 'player' back to bonus_type enum
-- =========================
-- Keyrðu þetta til að bæta við 'player' bonus type aftur

-- 1) Búa til nýtt enum með 'player'
create type public.bonus_type_new as enum ('number', 'choice', 'player');

-- 2) Breyta gögnunum
alter table public.bonus_questions 
  alter column type type text using type::text;

-- Breytum aftur í nýja enum
alter table public.bonus_questions 
  alter column type type public.bonus_type_new using type::bonus_type_new;

-- 3) Endurnefnum enum
drop type public.bonus_type;
alter type public.bonus_type_new rename to bonus_type;

-- 4) Uppfæra checks í bonus_questions (bæta við player check)
alter table public.bonus_questions 
  drop constraint if exists bonus_questions_check;

alter table public.bonus_questions 
  add constraint bonus_questions_check check (
    (correct_number is null and correct_player_id is null and correct_choice is null)
    or
    (type = 'number' and correct_number is not null and correct_player_id is null and correct_choice is null)
    or
    (type = 'choice' and correct_choice is not null and correct_number is null and correct_player_id is null)
    or
    (type = 'player' and correct_player_id is not null and correct_number is null and correct_choice is null)
  );

-- 5) Uppfæra checks í bonus_answers (bæta við player check)
alter table public.bonus_answers 
  drop constraint if exists bonus_answers_check;

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

