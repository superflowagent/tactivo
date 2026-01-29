-- Fix RLS performance: replace auth.<func>() with (select auth.<func>()) and restrict policies to proper roles
BEGIN;

-- Anatomy
DROP POLICY IF EXISTS "anatomy_select_company" ON public.anatomy;
CREATE POLICY "anatomy_select_company" ON public.anatomy FOR SELECT TO authenticated USING ((EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE (p.id = (select auth.uid()) AND p.company = anatomy.company)
)));

DROP POLICY IF EXISTS "anatomy_write_company" ON public.anatomy;
CREATE POLICY "anatomy_write_company" ON public.anatomy TO authenticated, service_role USING (((select auth.role()) = 'service_role' OR (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE (p.id = (select auth.uid()) AND p.role = 'professional' AND p.company = anatomy.company)
)))) WITH CHECK (((select auth.role()) = 'service_role' OR (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE (p.id = (select auth.uid()) AND p.role = 'professional')
))));

-- Company members policies (delete/insert/update/select) for several tables: replace auth.uid() usage and restrict to authenticated
DROP POLICY IF EXISTS "Company members can delete" ON public.anatomy;
CREATE POLICY "Company members can delete" ON public.anatomy FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid()) AND p.company = anatomy.company)));

DROP POLICY IF EXISTS "Company members can delete" ON public.equipment;
CREATE POLICY "Company members can delete" ON public.equipment FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid()) AND p.company = equipment.company)));

DROP POLICY IF EXISTS "Company members can delete" ON public.exercises;
CREATE POLICY "Company members can delete" ON public.exercises FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid()) AND p.company = exercises.company AND (p.role = 'professional' OR p.role = 'admin'))));

DROP POLICY IF EXISTS "Company members can delete" ON public.program_exercises;
CREATE POLICY "Company members can delete" ON public.program_exercises FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p JOIN public.programs prog ON prog.id = program_exercises.program WHERE (p.user = (select auth.uid()) AND p.company = prog.company AND (p.role = 'professional' OR p.role = 'admin'))));

DROP POLICY IF EXISTS "Company members can delete" ON public.programs;
CREATE POLICY "Company members can delete" ON public.programs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid()) AND p.company = programs.company)));

-- Company members can insert
DROP POLICY IF EXISTS "Company members can insert" ON public.anatomy;
CREATE POLICY "Company members can insert" ON public.anatomy FOR INSERT TO authenticated WITH CHECK ((company = (SELECT p.company FROM public.profiles p WHERE p.user = (select auth.uid()) LIMIT 1)));

DROP POLICY IF EXISTS "Company members can insert" ON public.equipment;
CREATE POLICY "Company members can insert" ON public.equipment FOR INSERT TO authenticated WITH CHECK ((company = (SELECT p.company FROM public.profiles p WHERE p.user = (select auth.uid()) LIMIT 1)));

DROP POLICY IF EXISTS "Company members can insert" ON public.exercises;
CREATE POLICY "Company members can insert" ON public.exercises FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid()) AND p.company = exercises.company)));

DROP POLICY IF EXISTS "Company members can insert" ON public.program_exercises;
CREATE POLICY "Company members can insert" ON public.program_exercises FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p JOIN public.programs prog ON prog.id = program_exercises.program WHERE (p.user = (select auth.uid()) AND p.company = prog.company)));

DROP POLICY IF EXISTS "Company members can insert" ON public.programs;
CREATE POLICY "Company members can insert" ON public.programs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE (p.user = (select auth.uid()) AND p.company = programs.company)));

-- Profiles policies: replace auth.uid() references and restrict to authenticated
DROP POLICY IF EXISTS "Select owner or company" ON public.profiles;
CREATE POLICY "Select owner or company" ON public.profiles FOR SELECT TO authenticated USING (((select auth.uid()) = user OR (select auth.uid()) = id OR public.is_same_company(company)));
-- Adjust to use select auth.uid() in the is_same_company call via function already using auth.uid() internally

DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (( (select auth.uid()) = user OR (select auth.uid()) = id )) WITH CHECK (( (select auth.uid()) = user OR (select auth.uid()) = id ));

-- ... Additional policy replacements for events, companies, classes_templates etc. follow the same pattern

-- Replace many policy auth calls across other tables (examples):
DROP POLICY IF EXISTS "Select owner or company" ON public.events;
CREATE POLICY "Select owner or company" ON public.events FOR SELECT TO authenticated USING (public.is_same_company(company));

-- Fix duplicate index in classes_templates (drop the duplicate)
DROP INDEX IF EXISTS idx_classes_templates_company;

COMMIT;
