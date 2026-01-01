-- Migration: Add points_per_correct_x column to admin_settings
-- This allows setting different points for X (draw) predictions

-- Add column (nullable, defaults to null which means use points_per_correct_1x2)
alter table public.admin_settings
add column if not exists points_per_correct_x int null;

-- Add comment
comment on column public.admin_settings.points_per_correct_x is 
  'Valfrjálst stig fyrir rétt X spá. Ef null, nota points_per_correct_1x2.';

