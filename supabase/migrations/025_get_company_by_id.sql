-- Migration: SECURITY DEFINER helper to safely fetch a company row for authenticated members

BEGIN;

-- Return the company row if caller is a member (uses is_member_of_company which is SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_company_by_id(p_company uuid)
RETURNS public.companies
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM public.companies
  WHERE id = p_company
    AND public.is_member_of_company(p_company)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_by_id(uuid) TO authenticated;

COMMIT;
