-- Migration: Add SECURITY DEFINER RPCs to read events (avoids policies hitting profiles directly)

BEGIN;

CREATE OR REPLACE FUNCTION public.get_events_by_company(p_company uuid)
RETURNS TABLE(id uuid, type text, datetime timestamptz, duration int, client uuid[], professional uuid[], company uuid, cost numeric, paid boolean, notes text, created timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT e.id, e.type, e.datetime, e.duration, e.client, e.professional, e.company, e.cost, e.paid, e.notes, e.created
  FROM public.events e
  WHERE e.company = p_company
    AND (
      public.is_member_of_company(e.company)
      OR auth.uid()::uuid = ANY (coalesce(e.client, ARRAY[]::uuid[]))
      OR auth.uid()::uuid = ANY (coalesce(e.professional, ARRAY[]::uuid[]))
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_events_by_company(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_event_by_id(p_event uuid)
RETURNS TABLE(id uuid, type text, datetime timestamptz, duration int, client uuid[], professional uuid[], company uuid, cost numeric, paid boolean, notes text, created timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT e.id, e.type, e.datetime, e.duration, e.client, e.professional, e.company, e.cost, e.paid, e.notes, e.created
  FROM public.events e
  WHERE e.id = p_event
    AND (
      public.is_member_of_company(e.company)
      OR auth.uid()::uuid = ANY (coalesce(e.client, ARRAY[]::uuid[]))
      OR auth.uid()::uuid = ANY (coalesce(e.professional, ARRAY[]::uuid[]))
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_event_by_id(uuid) TO authenticated;

COMMIT;
