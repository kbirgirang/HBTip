-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL UNIQUE,
  points_per_correct_1x2 integer NOT NULL DEFAULT 1,
  timezone text NOT NULL DEFAULT 'Atlantic/Reykjavik'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  points_per_correct_x integer,
  CONSTRAINT admin_settings_pkey PRIMARY KEY (id),
  CONSTRAINT admin_settings_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.bonus_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  member_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_number numeric,
  answer_player_id uuid,
  answer_choice text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bonus_answers_pkey PRIMARY KEY (id),
  CONSTRAINT bonus_answers_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT bonus_answers_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.room_members(id),
  CONSTRAINT bonus_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.bonus_questions(id),
  CONSTRAINT bonus_answers_answer_player_id_fkey FOREIGN KEY (answer_player_id) REFERENCES public.players(id)
);
CREATE TABLE public.bonus_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  match_id uuid NOT NULL,
  title text NOT NULL,
  type USER-DEFINED NOT NULL,
  points integer NOT NULL DEFAULT 5,
  closes_at timestamp with time zone NOT NULL,
  correct_number numeric,
  correct_player_id uuid,
  choice_options ARRAY,
  correct_choice text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  player_options jsonb,
  CONSTRAINT bonus_questions_pkey PRIMARY KEY (id),
  CONSTRAINT bonus_questions_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT bonus_questions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT bonus_questions_correct_player_id_fkey FOREIGN KEY (correct_player_id) REFERENCES public.players(id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  match_no integer,
  stage text,
  home_team text NOT NULL,
  away_team text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  allow_draw boolean NOT NULL DEFAULT true,
  result character CHECK (result = ANY (ARRAY['1'::bpchar, 'X'::bpchar, '2'::bpchar])),
  finished_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  underdog_team character CHECK (underdog_team = ANY (ARRAY['1'::bpchar, '2'::bpchar])),
  underdog_multiplier numeric CHECK (underdog_multiplier IS NULL OR underdog_multiplier >= 1.0),
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  full_name text NOT NULL,
  team text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.predictions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  member_id uuid NOT NULL,
  match_id uuid NOT NULL,
  pick character NOT NULL CHECK (pick = ANY (ARRAY['1'::bpchar, 'X'::bpchar, '2'::bpchar])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT predictions_pkey PRIMARY KEY (id),
  CONSTRAINT predictions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT predictions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.room_members(id),
  CONSTRAINT predictions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.room_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  display_name text NOT NULL,
  pin_hash text,
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  username USER-DEFINED NOT NULL,
  password_hash text NOT NULL,
  CONSTRAINT room_members_pkey PRIMARY KEY (id),
  CONSTRAINT room_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT room_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id)
);
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  room_code USER-DEFINED NOT NULL UNIQUE,
  room_name text NOT NULL,
  owner_password_hash text NOT NULL,
  join_password_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournaments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  api_football_league_id integer,
  api_football_season integer,
  api_football_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT tournaments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username USER-DEFINED NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);