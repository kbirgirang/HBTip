-- =========================
-- Migration: Remove 'player' from bonus_type enum
-- =========================
-- Keyrðu þetta ef þú ert með gömul gögn með 'player' í bonus_type enum

-- 1) Fjarlægja 'player' úr enum (ef það er til)
-- Ath: PostgreSQL leyfir ekki að fjarlægja enum values beint, svo við verðum að búa til nýtt enum
-- og breyta gögnunum

-- Droppa ALLA constraints sem nota 'type' column áður en við breytum type
alter table public.bonus_questions 
  drop constraint if exists bonus_questions_check;

-- Droppa líka constraint sem notar type <> 'choice'
alter table public.bonus_questions 
  drop constraint if exists bonus_questions_choice_options_check;

-- Athuga hvort það sé fleiri constraints sem nota type
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.bonus_questions'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%type%'
    LOOP
        EXECUTE format('ALTER TABLE public.bonus_questions DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

alter table public.bonus_answers 
  drop constraint if exists bonus_answers_check;

-- Búum til nýtt enum án 'player'
create type public.bonus_type_new as enum ('number', 'choice');

-- Breytum gögnunum - fyrst í text
alter table public.bonus_questions 
  alter column type type text using type::text;

-- Ef það eru gögn með 'player', breytum þeim í 'number' (eða 'choice' - veldu eftir þörfum)
update public.bonus_questions 
  set type = 'number' 
  where type = 'player';

-- Breytum aftur í nýja enum
alter table public.bonus_questions 
  alter column type type public.bonus_type_new using type::public.bonus_type_new;

-- Endurnefnum enum
drop type if exists public.bonus_type;
alter type public.bonus_type_new rename to bonus_type;

-- 2) Uppfæra checks í bonus_questions (fjarlægja player checks)
alter table public.bonus_questions 
  add constraint bonus_questions_check check (
    (correct_number is null and correct_player_id is null and correct_choice is null)
    or
    (type = 'number'::public.bonus_type and correct_number is not null and correct_player_id is null and correct_choice is null)
    or
    (type = 'choice'::public.bonus_type and correct_choice is not null and correct_number is null and correct_player_id is null)
  );

-- 3) Uppfæra checks í bonus_answers (fjarlægja player checks)
alter table public.bonus_answers 
  add constraint bonus_answers_check check (
    (answer_number is null and answer_player_id is null and answer_choice is null)
    or
    (answer_number is not null and answer_player_id is null and answer_choice is null)
    or
    (answer_choice is not null and answer_number is null and answer_player_id is null)
  );

notify pgrst, 'reload schema';
