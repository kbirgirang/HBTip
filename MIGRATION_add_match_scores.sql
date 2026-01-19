-- MIGRATION_add_match_scores.sql
-- Bætir við home_score og away_score reitum í matches töfluna

-- Bæta við reitum (ef þeir eru ekki þegar til)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'matches' 
                 AND column_name = 'home_score') THEN
    ALTER TABLE public.matches ADD COLUMN home_score integer NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'matches' 
                 AND column_name = 'away_score') THEN
    ALTER TABLE public.matches ADD COLUMN away_score integer NULL;
  END IF;
END $$;

-- Fjarlægja constraint ef það er til
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_scores_check;

-- Bæta við constraint
ALTER TABLE public.matches
ADD CONSTRAINT matches_scores_check 
CHECK (
  (home_score IS NULL AND away_score IS NULL) OR
  (home_score IS NOT NULL AND away_score IS NOT NULL AND home_score >= 0 AND away_score >= 0)
);

-- Bæta við comments
COMMENT ON COLUMN public.matches.home_score IS 'Mörk heimaliðs. Verður að vera sett ásamt away_score eða bæði null.';
COMMENT ON COLUMN public.matches.away_score IS 'Mörk útiliðs. Verður að vera sett ásamt home_score eða bæði null.';
