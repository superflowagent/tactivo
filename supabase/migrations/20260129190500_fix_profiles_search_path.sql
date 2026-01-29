-- Ensure SET search_path for missing overloads of profiles helper functions
BEGIN;

DO $$ BEGIN
  BEGIN ALTER FUNCTION public.get_profiles_by_ids_for_clients(uuid[]) SET search_path = 'public, pg_temp'; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_profiles_by_ids_for_clients(uuid[], uuid) SET search_path = 'public, pg_temp'; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_profiles_by_ids_for_professionals(uuid[]) SET search_path = 'public, pg_temp'; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_profiles_by_ids_for_professionals(uuid[], uuid) SET search_path = 'public, pg_temp'; EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;

COMMIT;
