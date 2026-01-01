-- =========================
-- Migration: Add username and password to room_members
-- =========================
-- Keyrðu þetta ef þú ert með gömlu gögnin

-- 1) Bæta við nýjum reitum
alter table public.room_members 
  add column if not exists username citext,
  add column if not exists password_hash text;

-- 2) Búa til username úr display_name fyrir gömlu gögnin (ef þau eru til)
update public.room_members 
  set username = lower(replace(display_name, ' ', '_')) || '_' || substring(id::text, 1, 8)
  where username is null;

-- 3) Búa til temporary password_hash fyrir gömlu gögnin (notendur verða að reset-a password)
-- Ath: þú þarft að setja default password hash hér eða láta notendur búa til nýjan aðgang
update public.room_members 
  set password_hash = '$2b$10$default_hash_here_replace_with_real_hash'
  where password_hash is null;

-- 4) Gera reitina required
alter table public.room_members 
  alter column username set not null,
  alter column password_hash set not null;

-- 5) Fjarlægja gamla unique constraint og bæta við nýjum
alter table public.room_members 
  drop constraint if exists room_members_room_id_display_name_key;

create unique index if not exists uq_room_members_username 
  on public.room_members(room_id, username);

-- 6) Fjarlægja pin_hash (ef þú vilt ekki nota það lengur)
-- alter table public.room_members drop column if exists pin_hash;

notify pgrst, 'reload schema';

