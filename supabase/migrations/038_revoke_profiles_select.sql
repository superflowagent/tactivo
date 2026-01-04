-- Migration: Revoke temporary debug SELECT on profiles from authenticated

BEGIN;

REVOKE SELECT ON public.profiles FROM authenticated;

COMMIT;
