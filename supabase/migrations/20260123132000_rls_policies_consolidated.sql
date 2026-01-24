-- Consolidated idempotent migration: RLS, policies, and dependent schema fixes
-- This file consolidates the following smaller migrations into a single migration that can be applied safely on an empty DB:
-- - 20260123123000_enable_rls_and_policies.sql
-- - 20260123124500_add_missing_profiles_policies.sql
-- - 20260123125500_add_missing_company_event_class_policies.sql
-- - 20260123130500_add_events_columns_and_policy.sql
-- - 20260123131500_add_events_owner_company_policies.sql

-- 1) Enable RLS on relevant tables
ALTER TABLE IF EXISTS public.classes_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.anatomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipment ENABLE ROW LEVEL SECURITY;

-- 2) Ensure important columns on events exist and defaults
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS "created" timestamp without time zone;
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS "duration" numeric;
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS "cost" numeric;
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS "paid" boolean;
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS "notes" text;

DO $$
BEGIN
  -- set defaults for client / professional arrays if missing
  BEGIN
    ALTER TABLE public.events ALTER COLUMN client SET DEFAULT '{}'::uuid[];
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;
  BEGIN
    ALTER TABLE public.events ALTER COLUMN professional SET DEFAULT '{}'::uuid[];
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;
END
$$;

-- 3) Create policies idempotently (examples copied from remote schema)
DO $$
BEGIN
  -- Profiles policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Delete own profile') THEN
    EXECUTE $policy$CREATE POLICY "Delete own profile" ON public.profiles FOR DELETE USING ((auth.uid()::uuid = "user") OR (auth.uid()::uuid = id));$policy$; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Enable insert for authenticated users only') THEN
    EXECUTE $policy$CREATE POLICY "Enable insert for authenticated users only" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Select owner or company') THEN
    EXECUTE $policy$CREATE POLICY "Select owner or company" ON public.profiles FOR SELECT USING ((auth.uid()::uuid = "user") OR (auth.uid()::uuid = id) OR public.is_same_company(company));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_delete_professional_same_company_delete') THEN
    EXECUTE $policy$CREATE POLICY profiles_delete_professional_same_company_delete ON public.profiles FOR DELETE USING ((EXISTS (SELECT 1 FROM public.profiles p2 WHERE ((p2.user::text = auth.uid()::text) AND (p2.role = 'professional'::text) AND (p2.company::text = profiles.company::text)))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_policy_delete_admins') THEN
    EXECUTE $policy$CREATE POLICY profiles_policy_delete_admins ON public.profiles FOR DELETE USING (public.is_profile_admin_of(company));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_policy_select_company_members') THEN
    EXECUTE $policy$CREATE POLICY profiles_policy_select_company_members ON public.profiles FOR SELECT USING (("user" = auth.uid()::uuid) OR public.is_profile_member_of(company));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_policy_update_company_members') THEN
    EXECUTE $policy$CREATE POLICY profiles_policy_update_company_members ON public.profiles FOR UPDATE USING ((public.is_profile_member_of(company) OR ("user" = auth.uid()::uuid))) WITH CHECK ((public.is_profile_member_of(company) OR ("user" = auth.uid()::uuid)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_admins_or_professionals') THEN
    EXECUTE $policy$CREATE POLICY profiles_update_admins_or_professionals ON public.profiles FOR UPDATE USING (((auth.role() = 'service_role'::text) OR (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))))) WITH CHECK (((auth.role() = 'service_role'::text) OR (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own') THEN
    EXECUTE $policy$CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid()::text = USER::text)) WITH CHECK ((auth.uid()::text = USER::text));$policy$;
  END IF;

  -- also ensure remote-named policy exists
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Update own profile') THEN
    EXECUTE $policy$CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING ((auth.uid()::uuid = "user") OR (auth.uid()::uuid = id)) WITH CHECK ((auth.uid()::uuid = "user") OR (auth.uid()::uuid = id));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_professional_same_company_update') THEN
    EXECUTE $policy$CREATE POLICY profiles_update_professional_same_company_update ON public.profiles FOR UPDATE USING ((EXISTS (SELECT 1 FROM public.profiles p2 WHERE ((p2.user::text = auth.uid()::text) AND (p2.role = 'professional'::text) AND (p2.company::text = profiles.company::text))))) WITH CHECK ((EXISTS (SELECT 1 FROM public.profiles p2 WHERE ((p2.user::text = auth.uid()::text) AND (p2.role = 'professional'::text) AND (p2.company::text = profiles.company::text)))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self_or_service') THEN
    EXECUTE $policy$CREATE POLICY profiles_update_self_or_service ON public.profiles FOR UPDATE USING (((auth.role() = 'service_role'::text) OR ((auth.uid()::uuid = "user") OR (auth.uid()::uuid = id)) OR public.is_same_company(company))) WITH CHECK (((auth.role() = 'service_role'::text) OR ((auth.uid()::uuid = "user") OR (auth.uid()::uuid = id)) OR public.is_same_company(company)));$policy$;
  END IF;

END
$$;

-- 4) companies policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='Select company for members') THEN
    EXECUTE $policy$CREATE POLICY "Select company for members" ON public.companies FOR SELECT USING (public.is_same_company(id));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='allow_select_companies_for_members') THEN
    EXECUTE $policy$CREATE POLICY "allow_select_companies_for_members" ON public.companies FOR SELECT USING (public.is_member_of_company(id));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_select_company_members') THEN
    EXECUTE $policy$CREATE POLICY companies_select_company_members ON public.companies FOR SELECT USING (public.is_profile_member_of(id));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_select_member') THEN
    EXECUTE $policy$CREATE POLICY companies_select_member ON public.companies FOR SELECT USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND (p.company = companies.id))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_update_professional') THEN
    EXECUTE $policy$CREATE POLICY companies_update_professional ON public.companies FOR UPDATE USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND (p.role = 'professional'::text) AND (p.company = companies.id)))) WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND (p.role = 'professional'::text))));$policy$;
  END IF;
END
$$;

-- 5) classes_templates policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes_templates' AND policyname='delete_classes_templates_by_professional') THEN
    EXECUTE $policy$CREATE POLICY delete_classes_templates_by_professional ON public.classes_templates FOR DELETE TO authenticated USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.user = auth.uid()::uuid) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes_templates' AND policyname='insert_classes_templates_by_professional') THEN
    EXECUTE $policy$CREATE POLICY insert_classes_templates_by_professional ON public.classes_templates FOR INSERT TO authenticated WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.user = auth.uid()::uuid) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes_templates' AND policyname='select_classes_templates_by_company') THEN
    EXECUTE $policy$CREATE POLICY select_classes_templates_by_company ON public.classes_templates FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.user = auth.uid()::uuid) AND (p.company = classes_templates.company))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes_templates' AND policyname='update_classes_templates_by_professional') THEN
    EXECUTE $policy$CREATE POLICY update_classes_templates_by_professional ON public.classes_templates FOR UPDATE TO authenticated USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.user = auth.uid()::uuid) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))) WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.user = auth.uid()::uuid) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text))));$policy$;
  END IF;
END
$$;

-- 6) events policies (consolidated to match remote)
DO $$
BEGIN
  -- basic owner/company policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Select owner or company') THEN
    EXECUTE $policy$CREATE POLICY "Select owner or company" ON public.events FOR SELECT USING (public.is_same_company(company));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Update owner or company') THEN
    EXECUTE $policy$CREATE POLICY "Update owner or company" ON public.events FOR UPDATE USING (public.is_same_company(company)) WITH CHECK (public.is_same_company(company));$policy$;
  END IF;

  -- Per-remote detailed policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_delete_company_members') THEN
    EXECUTE $policy$CREATE POLICY "events_delete_company_members" ON public.events FOR DELETE USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = events.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_delete_professional_or_service') THEN
    EXECUTE $policy$CREATE POLICY "events_delete_professional_or_service" ON public.events FOR DELETE USING ((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.id = auth.uid()::uuid AND p.role = 'professional'::text AND p.company = events.company))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_insert_professional_or_service') THEN
    EXECUTE $policy$CREATE POLICY "events_insert_professional_or_service" ON public.events FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.id = auth.uid()::uuid AND p.role = 'professional'::text))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_insert_professionals') THEN
    EXECUTE $policy$CREATE POLICY "events_insert_professionals" ON public.events FOR INSERT WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.role = 'professional'::text AND p.company = p.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_delete') THEN
    EXECUTE $policy$CREATE POLICY "events_policy_delete" ON public.events FOR DELETE USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = events.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_insert') THEN
    EXECUTE $policy$CREATE POLICY "events_policy_insert" ON public.events FOR INSERT WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.role = ANY (ARRAY['professional'::text, 'admin'::text]) AND p.company = p.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_select') THEN
    EXECUTE $policy$CREATE POLICY "events_policy_select" ON public.events FOR SELECT USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = events.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_update') THEN
    EXECUTE $policy$CREATE POLICY "events_policy_update" ON public.events FOR UPDATE USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = events.company))) WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = p.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_select_company_member') THEN
    EXECUTE $policy$CREATE POLICY "events_select_company_member" ON public.events FOR SELECT USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.id = auth.uid()::uuid AND p.company = events.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_select_company_members') THEN
    EXECUTE $policy$CREATE POLICY "events_select_company_members" ON public.events FOR SELECT USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = events.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_update_company_members') THEN
    EXECUTE $policy$CREATE POLICY "events_update_company_members" ON public.events FOR UPDATE USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = events.company))) WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.user = auth.uid()::uuid AND p.company = p.company)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_update_professional_or_service') THEN
    EXECUTE $policy$CREATE POLICY "events_update_professional_or_service" ON public.events FOR UPDATE USING ((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.id = auth.uid()::uuid AND p.role = 'professional'::text AND p.company = events.company)))) WITH CHECK ((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1 FROM public.profiles p WHERE (p.id = auth.uid()::uuid AND p.role = 'professional'::text))));$policy$;
  END IF;

  -- complex consolidated policy from remote (keeps previous behavior)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='select_events_by_company_and_role') THEN
    EXECUTE $policy$CREATE POLICY select_events_by_company_and_role ON public.events FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()::uuid AND p.company = events.company AND (p.role = 'professional'::text OR (p.role = 'client'::text AND (events.type = 'class'::text OR (events.type = 'appointment'::text AND (p.id = ANY (events.client) OR p.user = ANY (events.client))))))));$policy$;
  END IF;
END
$$;

-- Misc company-member policies for resources (anatomy, equipment, exercises, program_exercises, programs)
DO $$
BEGIN
  -- Anatomy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anatomy' AND policyname='Company members can delete') THEN
    EXECUTE $policy$CREATE POLICY "Company members can delete" ON public.anatomy FOR DELETE TO public USING (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = anatomy.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anatomy' AND policyname='Company members can insert') THEN
    EXECUTE $policy$CREATE POLICY "Company members can insert" ON public.anatomy FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = anatomy.company) AND (p.role = 'professional'::text))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anatomy' AND policyname='Company members can select') THEN
    EXECUTE $policy$CREATE POLICY "Company members can select" ON public.anatomy FOR SELECT TO public USING (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = anatomy.company))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anatomy' AND policyname='Company members can update') THEN
    EXECUTE $policy$CREATE POLICY "Company members can update" ON public.anatomy FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = anatomy.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))) ) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = anatomy.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))));$policy$;
  END IF;

  -- Exercises
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exercises' AND policyname='Company members can delete') THEN
    EXECUTE $policy$CREATE POLICY "Company members can delete" ON public.exercises FOR DELETE TO public USING (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exercises' AND policyname='Company members can insert') THEN
    EXECUTE $policy$CREATE POLICY "Company members can insert" ON public.exercises FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = exercises.company) AND (p.role = 'professional'::text))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exercises' AND policyname='Company members can select') THEN
    EXECUTE $policy$CREATE POLICY "Company members can select" ON public.exercises FOR SELECT TO public USING (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = exercises.company))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exercises' AND policyname='Company members can update') THEN
    EXECUTE $policy$CREATE POLICY "Company members can update" ON public.exercises FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))) ) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))));$policy$;
  END IF;

  -- program_exercises and programs (company members)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='program_exercises' AND policyname='Company members can delete') THEN
    EXECUTE $policy$CREATE POLICY "Company members can delete" ON public.program_exercises FOR DELETE TO public USING (EXISTS (SELECT 1 FROM public.profiles p JOIN public.programs prog ON p.company = prog.company WHERE ((p."user" = auth.uid()::uuid) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programs' AND policyname='Company members can select') THEN
    EXECUTE $policy$CREATE POLICY "Company members can select" ON public.programs FOR SELECT TO public USING (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = programs.company))));$policy$;
  END IF;
END
$$;

-- 7) Storage (buckets / objects) policies
-- Enable RLS on storage.objects so policies can be enforced (wrapped to ignore permission issues)
DO $$
BEGIN
  BEGIN
    ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN
    -- ignore permission errors (table owner may differ in local env)
    PERFORM 1;
  END;
END
$$;

DO $$
BEGIN
  -- profile_photos: allow actions for authenticated users only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='allow_profile_photos_delete') THEN
    EXECUTE $policy$CREATE POLICY "allow_profile_photos_delete" ON storage.objects FOR DELETE TO public USING (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='allow_profile_photos_insert') THEN
    EXECUTE $policy$CREATE POLICY "allow_profile_photos_insert" ON storage.objects FOR INSERT TO public WITH CHECK (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='allow_profile_photos_select') THEN
    EXECUTE $policy$CREATE POLICY "allow_profile_photos_select" ON storage.objects FOR SELECT TO public USING (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));$policy$;
  END IF;

  -- company_logos: restrict by company prefix (first path segment) matching caller's company
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='allow_company_logos_delete') THEN
    EXECUTE $policy$CREATE POLICY "allow_company_logos_delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'company_logos'::text) AND (substring(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company FROM public.profiles WHERE (profiles."user" = auth.uid()) LIMIT 1))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='allow_company_logos_insert') THEN
    EXECUTE $policy$CREATE POLICY "allow_company_logos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'company_logos'::text) AND (substring(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company FROM public.profiles WHERE (profiles."user" = auth.uid()) LIMIT 1))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='allow_company_logos_select') THEN
    EXECUTE $policy$CREATE POLICY "allow_company_logos_select" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'company_logos'::text) AND (substring(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company FROM public.profiles WHERE (profiles."user" = auth.uid()) LIMIT 1))));$policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='allow_company_logos_update') THEN
    EXECUTE $policy$CREATE POLICY "allow_company_logos_update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'company_logos'::text) AND (substring(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company FROM public.profiles WHERE (profiles."user" = auth.uid()) LIMIT 1))));$policy$;
  END IF;
END
$$;

-- End of consolidated migration
