-- Migration: Debug helper to inspect auth.uid() and caller's company

BEGIN;

-- Debug function to return caller auth.uid() and their company (if any)
CREATE OR REPLACE FUNCTION public.debug_get_caller_info()
RETURNS TABLE(caller_uid text, caller_company uuid)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.uid()::text AS caller_uid,
    (SELECT company FROM public.profiles WHERE user::text = auth.uid()::text LIMIT 1) AS caller_company;
$$;
GRANT EXECUTE ON FUNCTION public.debug_get_caller_info() TO authenticated;

COMMIT;
