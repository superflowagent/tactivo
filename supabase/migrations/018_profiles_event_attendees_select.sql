-- Migration: Allow clients to SELECT profile fields for event attendees

BEGIN;

-- Enable RLS on profiles (idempotent)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own profile (owner access)
DROP POLICY IF EXISTS "allow_select_own_profile" ON public.profiles;
CREATE POLICY "allow_select_own_profile" ON public.profiles
  FOR SELECT
  USING (
    auth.uid()::text = (user)::text OR auth.uid()::text = (id)::text
  );

-- Allow authenticated users to select profiles that are attendees (client or professional) of any event
DROP POLICY IF EXISTS "allow_select_event_attendees" ON public.profiles;
CREATE POLICY "allow_select_event_attendees" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE (
        (profiles.id = ANY (coalesce(e.client, ARRAY[]::uuid[])))
        OR (profiles.id = ANY (coalesce(e.professional, ARRAY[]::uuid[])))
      )
      -- Restrict to events in the same company as the profile (best-effort)
      AND (e.company IS NULL OR e.company = profiles.company)
    )
  );

COMMIT;
