-- Migration: debug function returning pg_trigger and associated function names for the `profiles` relation

BEGIN;

DROP FUNCTION IF EXISTS public.debug_list_pg_triggers_profiles();

CREATE OR REPLACE FUNCTION public.debug_list_pg_triggers_profiles()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_agg(row_to_json(q)) FROM (
    SELECT t.tgname, p.proname as function_name, n.nspname as function_schema, t.tgenabled
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.profiles'::regclass
  ) q;
$$;

COMMIT;