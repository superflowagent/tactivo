-- Migration: add a small helper to return trigger metadata for profiles table (debug only)

BEGIN;

DROP FUNCTION IF EXISTS public.debug_list_profiles_triggers();

CREATE OR REPLACE FUNCTION public.debug_list_profiles_triggers()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_agg(row_to_json(t)) FROM information_schema.triggers t WHERE t.event_object_table = 'profiles';
$$;

COMMIT;