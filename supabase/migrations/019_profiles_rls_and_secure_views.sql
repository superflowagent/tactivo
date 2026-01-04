-- Migration: Enforce company-only access, limit client-visible columns, and enable proper update/delete policies

BEGIN;

-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove older/temporary policies if present
DROP POLICY IF EXISTS "allow_select_event_attendees" ON public.profiles;
DROP POLICY IF EXISTS "allow_select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_professional_same_company ON public.profiles;

-- REVOKE direct SELECT from authenticated to prevent brute-force column reads
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM public;

-- Allow UPDATE/DELETE to authenticated but protect with RLS policies below
GRANT UPDATE, DELETE ON public.profiles TO authenticated;

-- Policy: allow a user to UPDATE only their own profile
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (auth.uid()::text = user::text)
  WITH CHECK (auth.uid()::text = user::text);

-- Policy: allow professionals in the same company to UPDATE or DELETE profiles in their company
DROP POLICY IF EXISTS profiles_update_professional_same_company_update ON public.profiles;
CREATE POLICY profiles_update_professional_same_company_update ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.user::text = auth.uid()::text
        AND p2.role = 'professional'
        AND p2.company::text = public.profiles.company::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.user::text = auth.uid()::text
        AND p2.role = 'professional'
        AND p2.company::text = public.profiles.company::text
    )
  );

DROP POLICY IF EXISTS profiles_delete_professional_same_company_delete ON public.profiles;
CREATE POLICY profiles_delete_professional_same_company_delete ON public.profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.user::text = auth.uid()::text
        AND p2.role = 'professional'
        AND p2.company::text = public.profiles.company::text
    )
  );

-- SECURITY DEFINER: function to return only allowed columns for event attendees
CREATE OR REPLACE FUNCTION public.get_event_attendee_profiles(p_event uuid)
RETURNS TABLE(id uuid, name text, last_name text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  JOIN public.events e ON e.id = p_event
  WHERE (p.id = ANY(coalesce(e.client, ARRAY[]::uuid[])) OR p.id = ANY(coalesce(e.professional, ARRAY[]::uuid[])))
    AND p.company IS NOT DISTINCT FROM (
      SELECT company FROM public.profiles WHERE user = auth.uid()::text LIMIT 1
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_event_attendee_profiles(uuid) TO authenticated;

-- SECURITY DEFINER: function for professionals to get full profiles within their company
CREATE OR REPLACE FUNCTION public.get_profiles_for_professionals()
RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE p.company IS NOT DISTINCT FROM (
    SELECT company FROM public.profiles WHERE user::text = auth.uid()::text LIMIT 1
  )
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_profiles_for_professionals() TO authenticated;

COMMIT;
