-- =========================
-- Migration: Allow users to be in multiple rooms with same username
-- =========================
-- Keyrðu þetta til að leyfa notendum að vera í fleiri deildum með sama username

-- 1) Fjarlægja unique constraint á (room_id, username)
-- Athuga fyrst hvað constraint heitir
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Finna nafn á constraint
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.room_members'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
      AND conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.room_members'::regclass AND attname = 'room_id')
      AND conkey[2] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.room_members'::regclass AND attname = 'username');
    
    -- Ef constraint finnst, fjarlægja hann
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.room_members DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

-- 2) Búa til nýjan unique constraint sem er bara á (room_id, username) fyrir sömu deild
-- (þetta er nú þegar gert með unique (room_id, username), svo við þurfum ekki að gera neitt hér)

-- 3) Búa til index fyrir betri leit (ekki unique)
CREATE INDEX IF NOT EXISTS idx_room_members_username 
  ON public.room_members(username);

notify pgrst, 'reload schema';

