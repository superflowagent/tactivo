-- Migration: allow authenticated users to SELECT the company row for their own company

BEGIN;

-- Enable RLS on companies (idempotent)
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;

-- Remove any old permissive policies that may leak data
DROP POLICY IF EXISTS "allow_select_companies" ON public.companies;

-- Allow SELECT if the caller belongs to the company (via profiles.user -> profiles.company)
CREATE POLICY allow_select_companies_for_members ON public.companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user::text = auth.uid()::text
        AND p.company::text = public.companies.id::text
    )
  );

COMMIT;
