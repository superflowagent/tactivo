-- Migration: 004_companies_policies_fix.sql
-- Purpose: Fix SELECT policy for companies to allow profiles that reference the auth user
-- by either `user` column or primary key `id` (robust across legacy schemas).

ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select_company_members ON public.companies;
CREATE POLICY companies_select_company_members ON public.companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.user = auth.uid() OR p.id = auth.uid()) AND p.company = public.companies.id
  )
);

-- Note: After applying this migration, reload the API schema in Supabase Dashboard (Settings -> API -> Reload schema)
-- to avoid PostgREST schema cache related errors (PGRST204). Test login and company select afterwards.
