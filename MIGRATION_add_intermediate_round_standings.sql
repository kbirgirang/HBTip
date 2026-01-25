-- MIGRATION_add_intermediate_round_standings.sql
-- Bætir við töflu fyrir milliriðilastöðu (intermediate round standings)

-- Búa til töflu fyrir milliriðilastöðu
CREATE TABLE IF NOT EXISTS public.intermediate_round_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number IN (1, 2)), -- Milliriðil 1 eða 2
  team text NOT NULL,
  gp integer NOT NULL DEFAULT 0 CHECK (gp >= 0), -- Games Played
  win integer NOT NULL DEFAULT 0 CHECK (win >= 0),
  draw integer NOT NULL DEFAULT 0 CHECK (draw >= 0),
  lose integer NOT NULL DEFAULT 0 CHECK (lose >= 0),
  dp integer NOT NULL DEFAULT 0, -- Goal Difference (Differens)
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0), -- Stig
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round_number, team) -- Eitt lið getur bara verið einu sinni í hverjum milliriðli
);

-- Búa til index
CREATE INDEX IF NOT EXISTS idx_intermediate_round_standings_tournament_round 
  ON public.intermediate_round_standings(tournament_id, round_number);

-- Búa til trigger fyrir updated_at
CREATE TRIGGER trg_intermediate_round_standings_updated_at
BEFORE UPDATE ON public.intermediate_round_standings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comments
COMMENT ON TABLE public.intermediate_round_standings IS 'Stöður liða í milliriðlum (intermediate rounds)';
COMMENT ON COLUMN public.intermediate_round_standings.round_number IS 'Númer milliriðils: 1 eða 2';
COMMENT ON COLUMN public.intermediate_round_standings.gp IS 'Games Played - Fjöldi leikja';
COMMENT ON COLUMN public.intermediate_round_standings.win IS 'Fjöldi sigra';
COMMENT ON COLUMN public.intermediate_round_standings.draw IS 'Fjöldi jafntefla';
COMMENT ON COLUMN public.intermediate_round_standings.lose IS 'Fjöldi tapa';
COMMENT ON COLUMN public.intermediate_round_standings.dp IS 'Goal Difference (Differens)';
COMMENT ON COLUMN public.intermediate_round_standings.points IS 'Stig';
