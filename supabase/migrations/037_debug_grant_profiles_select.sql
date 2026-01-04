-- Migration (debug): Temporarily grant direct SELECT on profiles to authenticated to detect which policy/function needs it

BEGIN;

GRANT SELECT ON public.profiles TO authenticated;

COMMIT;
