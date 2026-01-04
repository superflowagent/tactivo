-- Migration: Add secure RLS policies for events using helper functions

BEGIN;

-- SECURITY DEFINER helper: check if current user is a professional in the given company
CREATE OR REPLACE FUNCTION public.is_professional_of_company(p_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.role = 'professional'
      AND p.company::text = p_company::text
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_professional_of_company(uuid) TO authenticated;

-- Enable RLS on events (idempotent)
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

-- Remove any old/legacy policies for events (if present)
DROP POLICY IF EXISTS allow_select_events_for_members ON public.events;
DROP POLICY IF EXISTS allow_insert_events_for_professionals ON public.events;
DROP POLICY IF EXISTS allow_update_events_for_members ON public.events;
DROP POLICY IF EXISTS allow_delete_events_for_professionals ON public.events;

-- Allow SELECT for company members and attendees
CREATE POLICY allow_select_events_for_members ON public.events
  FOR SELECT
  USING (
    public.is_member_of_company(company)
    OR auth.uid()::uuid = ANY (coalesce(client, ARRAY[]::uuid[]))
    OR auth.uid()::uuid = ANY (coalesce(professional, ARRAY[]::uuid[]))
  );

-- Allow INSERT only for professionals of the company
CREATE POLICY allow_insert_events_for_professionals ON public.events
  FOR INSERT
  USING (
    public.is_professional_of_company(company)
  )
  WITH CHECK (
    public.is_professional_of_company(company)
  );

-- Allow UPDATE by company members or attendees; ensure new rows still respect company membership or that client list contains the auth user
CREATE POLICY allow_update_events_for_members ON public.events
  FOR UPDATE
  USING (
    public.is_member_of_company(company)
    OR auth.uid()::uuid = ANY (coalesce(client, ARRAY[]::uuid[]))
  )
  WITH CHECK (
    public.is_member_of_company(company)
    OR auth.uid()::uuid = ANY (coalesce(client, ARRAY[]::uuid[]))
  );

-- Allow DELETE only for professionals of the company
CREATE POLICY allow_delete_events_for_professionals ON public.events
  FOR DELETE
  USING (
    public.is_professional_of_company(company)
  );

COMMIT;
