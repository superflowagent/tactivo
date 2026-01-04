-- Migration: Create RPC get_company_by_id to fetch company row only if caller is member

BEGIN;

CREATE OR REPLACE FUNCTION public.get_company_by_id(p_company uuid)
RETURNS SETOF public.companies
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT c.*
  FROM public.companies c
  WHERE c.id = p_company
    AND public.is_member_of_company(c.id)
$$;

GRANT EXECUTE ON FUNCTION public.get_company_by_id(uuid) TO authenticated;

COMMIT;
