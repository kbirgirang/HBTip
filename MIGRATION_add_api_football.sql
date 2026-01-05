-- =========================
-- Migration: Add API-Football integration fields to tournaments
-- =========================
-- Keyrðu þetta til að bæta við API-Football integration

-- Bæta við reitum fyrir API-Football integration
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS api_football_league_id INTEGER NULL,
ADD COLUMN IF NOT EXISTS api_football_season INTEGER NULL,
ADD COLUMN IF NOT EXISTS api_football_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Bæta við comments
COMMENT ON COLUMN public.tournaments.api_football_league_id IS 'API-Football league ID (e.g. 39 for Premier League, 140 for La Liga)';
COMMENT ON COLUMN public.tournaments.api_football_season IS 'API-Football season year (e.g. 2024)';
COMMENT ON COLUMN public.tournaments.api_football_enabled IS 'Enable automatic sync with API-Football for this tournament';

-- Bæta við index ef þú vilt leita eftir enabled tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_api_football_enabled 
ON public.tournaments(api_football_enabled) 
WHERE api_football_enabled = true;

notify pgrst, 'reload schema';

