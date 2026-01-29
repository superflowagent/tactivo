-- Explicitly replace auth.* calls in remaining RLS policies flagged by advisor, adding TO clauses where appropriate
BEGIN;

-- Events
DROP POLICY IF EXISTS "events_policy_select" ON public.events;
CREATE POLICY "events_policy_select" ON public.events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = events.company)));

DROP POLICY IF EXISTS "events_policy_update" ON public.events;
CREATE POLICY "events_policy_update" ON public.events FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = events.company))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = events.company)));

DROP POLICY IF EXISTS "events_select_company_member" ON public.events;
CREATE POLICY "events_select_company_member" ON public.events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.id = (select auth.uid())::uuid AND p.company = events.company)));

DROP POLICY IF EXISTS "events_select_company_members" ON public.events;
CREATE POLICY "events_select_company_members" ON public.events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = events.company)));

DROP POLICY IF EXISTS "events_update_company_members" ON public.events;
CREATE POLICY "events_update_company_members" ON public.events FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = events.company))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = events.company)));

DROP POLICY IF EXISTS "events_update_professional_or_service" ON public.events;
CREATE POLICY "events_update_professional_or_service" ON public.events FOR UPDATE TO authenticated, service_role USING (((select auth.role()) = 'service_role' OR (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.id = (select auth.uid())::uuid AND p.role = 'professional' AND p.company = events.company))))) WITH CHECK (((select auth.role()) = 'service_role' OR (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.id = (select auth.uid())::uuid AND p.role = 'professional')))));

-- Classes templates
DROP POLICY IF EXISTS "insert_classes_templates_by_professional" ON public.classes_templates;
CREATE POLICY "insert_classes_templates_by_professional" ON public.classes_templates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = classes_templates.company AND p.role = 'professional')));

DROP POLICY IF EXISTS "select_classes_templates_by_company" ON public.classes_templates;
CREATE POLICY "select_classes_templates_by_company" ON public.classes_templates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = classes_templates.company)));

DROP POLICY IF EXISTS "update_classes_templates_by_professional" ON public.classes_templates;
CREATE POLICY "update_classes_templates_by_professional" ON public.classes_templates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = classes_templates.company AND p.role = 'professional'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = classes_templates.company AND p.role = 'professional')));

-- Profiles: ensure SELECT/UPDATE policies use select auth.uid() and explicit TO
DROP POLICY IF EXISTS "profiles_policy_select_company_members" ON public.profiles;
CREATE POLICY "profiles_policy_select_company_members" ON public.profiles FOR SELECT TO authenticated USING (((select auth.uid())::uuid = "user") OR public.is_profile_member_of(company));

DROP POLICY IF EXISTS "profiles_policy_update_company_members" ON public.profiles;
CREATE POLICY "profiles_policy_update_company_members" ON public.profiles FOR UPDATE TO authenticated USING (public.is_profile_member_of(company) OR ((select auth.uid())::uuid = "user")) WITH CHECK (public.is_profile_member_of(company) OR ((select auth.uid())::uuid = "user"));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (((select auth.uid())::uuid = "user")) WITH CHECK (((select auth.uid())::uuid = "user"));

-- events selection by company/role
DROP POLICY IF EXISTS "select_events_by_company_and_role" ON public.events;
CREATE POLICY "select_events_by_company_and_role" ON public.events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid())::uuid AND p.company = events.company AND (p.role = 'professional' OR (p.role = 'client' AND (events.type = 'class' OR (events.type = 'appointment' AND (p.id = ANY(events.client) OR p.user = ANY(events.client)))))))));

-- any remaining performance adjustments can be added here

COMMIT;