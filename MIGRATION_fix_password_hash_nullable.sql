-- ==========================================
-- FIX: Gera password_hash nullable í room_members
-- ==========================================
-- Keyrðu þetta ef þú færð villu um NOT NULL constraint á password_hash
-- 
-- ATH: Ef þú ert með gömlu gögnin sem þurfa password_hash, keyrðu
-- MIGRATION_add_username_password.sql fyrst til að setja default values

-- Gera password_hash nullable (ef hann er NOT NULL)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'room_members'
      and column_name = 'password_hash'
      and is_nullable = 'NO'
  ) then
    alter table public.room_members
      alter column password_hash drop not null;
  end if;
end $$;

-- Gera username nullable líka (ef hann er NOT NULL)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'room_members'
      and column_name = 'username'
      and is_nullable = 'NO'
  ) then
    alter table public.room_members
      alter column username drop not null;
  end if;
end $$;

notify pgrst, 'reload schema';

