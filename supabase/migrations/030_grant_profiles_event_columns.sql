-- Migration: allow authenticated to SELECT minimal profile columns needed for events

BEGIN;

-- Allow authenticated to read minimal columns for event attendees and policy checks
GRANT SELECT (id, name, last_name, photo_path, company) ON public.profiles TO authenticated;

COMMIT;
