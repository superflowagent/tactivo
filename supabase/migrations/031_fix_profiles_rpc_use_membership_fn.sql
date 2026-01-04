-- Migration: Fix profile RPCs to use is_member_of_company helper to avoid auth.uid() subquery visibility issues

BEGIN;

-- Replace get_profiles_by_ids_for_clients to use is_member_of_company
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_clients(p_ids uuid[])
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  WHERE (p.user = ANY(p_ids) OR p.id = ANY(p_ids))
    AND public.is_member_of_company(p.company);
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids_for_clients(uuid[]) TO authenticated;

-- Replace get_profiles_by_ids_for_professionals to use is_member_of_company
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_professionals(p_ids uuid[])
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE (p.user = ANY(p_ids) OR p.id = ANY(p_ids))
    AND public.is_member_of_company(p.company)
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids_for_professionals(uuid[]) TO authenticated;

-- Replace get_event_attendee_profiles to use is_member_of_company
CREATE OR REPLACE FUNCTION public.get_event_attendee_profiles(p_event uuid)
RETURNS TABLE(id uuid, name text, last_name text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  JOIN public.events e ON e.id = p_event
  WHERE (p.id = ANY(coalesce(e.client, ARRAY[]::uuid[])) OR p.id = ANY(coalesce(e.professional, ARRAY[]::uuid[])))
    AND public.is_member_of_company(p.company);
$$;
GRANT EXECUTE ON FUNCTION public.get_event_attendee_profiles(uuid) TO authenticated;

-- Replace get_profiles_for_professionals to use is_member_of_company
CREATE OR REPLACE FUNCTION public.get_profiles_for_professionals()
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE public.is_member_of_company(p.company)
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_for_professionals() TO authenticated;

COMMIT;