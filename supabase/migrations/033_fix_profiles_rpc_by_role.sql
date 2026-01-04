-- Migration: Fix role-based profile RPCs to use is_member_of_company helper

BEGIN;

CREATE OR REPLACE FUNCTION public.get_profiles_by_role_for_clients(p_role text)
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  WHERE p.role = p_role
    AND public.is_member_of_company(p.company);
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_role_for_clients(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profiles_by_role_for_professionals(p_role text)
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE p.role = p_role
    AND public.is_member_of_company(p.company)
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_role_for_professionals(text) TO authenticated;

COMMIT;