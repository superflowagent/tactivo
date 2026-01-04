-- Migration: Add SECURITY DEFINER RPC to read events for a company with caller checks

BEGIN;

CREATE OR REPLACE FUNCTION public.get_events_for_company(p_company uuid)
RETURNS TABLE(id uuid, type text, datetime timestamptz, duration int, client uuid[], professional uuid[], company uuid, cost numeric, paid boolean, notes text, created timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT e.id, e.type, e.datetime, e.duration, e.client, e.professional, e.company, e.cost, e.paid, e.notes, e.created
  FROM public.events e
  WHERE e.company = p_company
    AND (
      -- caller is member of the company (professional/admin)
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user::text = auth.uid()::text AND p.company::text = p_company::text
      )
      -- OR caller is an attendee (their profile id is listed in client or professional)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user::text = auth.uid()::text
          AND (
            p.id = ANY (coalesce(e.client, ARRAY[]::uuid[]))
            OR p.id = ANY (coalesce(e.professional, ARRAY[]::uuid[]))
          )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_events_for_company(uuid) TO authenticated;

COMMIT;
