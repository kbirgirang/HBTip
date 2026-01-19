-- =========================
-- Fix set_updated_at function search_path warning
-- =========================
-- This fixes the "function_search_path_mutable" warning by setting
-- the search_path parameter on the function

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
