-- Migration: Use SECURITY DEFINER function to check company membership in policies

BEGIN;

-- Create a SECURITY DEFINER helper so policies don't require direct SELECT on profiles
CREATE OR REPLACE FUNCTION public.is_member_of_company(p_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.company::text = p_company::text
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_member_of_company(uuid) TO authenticated;

-- Replace policy to use the function
DROP POLICY IF EXISTS allow_select_companies_for_members ON public.companies;
CREATE POLICY allow_select_companies_for_members ON public.companies
  FOR SELECT
  USING (public.is_member_of_company(id));

COMMIT;
