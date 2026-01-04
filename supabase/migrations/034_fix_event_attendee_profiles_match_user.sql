-- Migration: Fix get_event_attendee_profiles to match profiles by user or id and ensure company membership check

BEGIN;

CREATE OR REPLACE FUNCTION public.get_event_attendee_profiles(p_event uuid)
RETURNS TABLE(id uuid, name text, last_name text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  JOIN public.events e ON e.id = p_event
  WHERE (
    p.user = ANY(coalesce(e.client, ARRAY[]::uuid[]))
    OR p.id = ANY(coalesce(e.client, ARRAY[]::uuid[]))
    OR p.user = ANY(coalesce(e.professional, ARRAY[]::uuid[]))
    OR p.id = ANY(coalesce(e.professional, ARRAY[]::uuid[]))
  )
    AND public.is_member_of_company(p.company);
$$;
GRANT EXECUTE ON FUNCTION public.get_event_attendee_profiles(uuid) TO authenticated;

COMMIT;