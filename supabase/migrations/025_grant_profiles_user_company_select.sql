-- Migration: Allow SELECT on minimal columns (user, company) from profiles for authenticated role

BEGIN;

GRANT SELECT ("user", company) ON public.profiles TO authenticated;

COMMIT;
