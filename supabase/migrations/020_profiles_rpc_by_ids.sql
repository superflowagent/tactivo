-- Migration: Add RPCs to fetch profiles by ids for clients and professionals (column-restricted)

BEGIN;

-- Function for clients: returns only id, user, name, last_name, photo_path for given ids within same company
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_clients(p_ids uuid[])
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  WHERE (p.user = ANY(p_ids) OR p.id = ANY(p_ids))
    AND p.company IS NOT DISTINCT FROM (
      SELECT company FROM public.profiles WHERE user::text = auth.uid()::text LIMIT 1
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids_for_clients(uuid[]) TO authenticated;

-- Function for professionals: returns full profile columns for given ids within same company and caller must be professional
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_professionals(p_ids uuid[])
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE (p.user = ANY(p_ids) OR p.id = ANY(p_ids))
    AND p.company IS NOT DISTINCT FROM (
      SELECT company FROM public.profiles WHERE user::text = auth.uid()::text LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids_for_professionals(uuid[]) TO authenticated;

COMMIT;
