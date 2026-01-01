-- Migration: 002_events_policies.sql
-- Purpose: add row-level security policies for `events` so authenticated users
-- who belong to the same company (and professionals) can create/update/delete/select events.

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

-- SELECT: allow authenticated users to read events if their profile.company matches the event company
DROP POLICY IF EXISTS events_select_company_members ON public.events;
CREATE POLICY events_select_company_members ON public.events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = auth.uid() AND p.company = public.events.company
  )
);

-- INSERT: allow only professionals (role = 'professional') belonging to that company to create events
DROP POLICY IF EXISTS events_insert_professionals ON public.events;
CREATE POLICY events_insert_professionals ON public.events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = auth.uid() AND p.role = 'professional' AND p.company = company
  )
);

-- UPDATE: allow company members to update events of their company; ensure new.company remains the same company
DROP POLICY IF EXISTS events_update_company_members ON public.events;
CREATE POLICY events_update_company_members ON public.events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = auth.uid() AND p.company = public.events.company
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = auth.uid() AND p.company = company
  )
);

-- DELETE: allow company members to delete events in their company
DROP POLICY IF EXISTS events_delete_company_members ON public.events;
CREATE POLICY events_delete_company_members ON public.events
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = auth.uid() AND p.company = public.events.company
  )
);

-- Notes:
-- * Adjust the role checks above if your schema uses different role values (e.g. "pro", "professional")
-- * If you need different behavior (e.g. only admins can delete), modify the DELETE policy accordingly.
-- * Test these policies in a dev project before applying to production.