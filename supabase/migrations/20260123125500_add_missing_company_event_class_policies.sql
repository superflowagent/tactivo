-- Idempotent migration: add missing policies for classes_templates, companies, events

-- Ensure RLS is enabled on affected tables
ALTER TABLE IF EXISTS public.classes_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  -- classes_templates: select_classes_templates_by_company
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'classes_templates' AND policyname = 'select_classes_templates_by_company') THEN
    EXECUTE $q$
    CREATE POLICY "select_classes_templates_by_company" ON "public"."classes_templates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "classes_templates"."company")))));
    $q$;
  END IF;

  -- classes_templates: update_classes_templates_by_professional
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'classes_templates' AND policyname = 'update_classes_templates_by_professional') THEN
    EXECUTE $q$
    CREATE POLICY "update_classes_templates_by_professional" ON "public"."classes_templates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "classes_templates"."company") AND ("p"."role" = 'professional'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "classes_templates"."company") AND ("p"."role" = 'professional'::"text")))));
    $q$;
  END IF;

  -- companies: Select company for members
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Select company for members') THEN
    EXECUTE $q$
    CREATE POLICY "Select company for members" ON "public"."companies" FOR SELECT USING ("public"."is_same_company"("id"));
    $q$;
  END IF;

  -- companies: allow_select_companies_for_members
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'allow_select_companies_for_members') THEN
    EXECUTE $q$
    CREATE POLICY "allow_select_companies_for_members" ON "public"."companies" FOR SELECT USING ("public"."is_member_of_company"("id"));
    $q$;
  END IF;

  -- events: Select owner or company
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Select owner or company') THEN
    EXECUTE $q$
    CREATE POLICY "Select owner or company" ON "public"."events" FOR SELECT USING ("public"."is_same_company"("company"));
    $q$;
  END IF;

  -- events: Update owner or company
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Update owner or company') THEN
    EXECUTE $q$
    CREATE POLICY "Update owner or company" ON "public"."events" FOR UPDATE USING ("public"."is_same_company"("company")) WITH CHECK ("public"."is_same_company"("company"));
    $q$;
  END IF;

  -- events: select_events_by_company_and_role (complex predicate)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'select_events_by_company_and_role') THEN
    EXECUTE $q$
    CREATE POLICY "select_events_by_company_and_role" ON "public"."events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "events"."company") AND (("p"."role" = 'professional'::"text") OR (("p"."role" = 'client'::"text") AND (("events"."type" = 'class'::"text") OR (("events"."type" = 'appointment'::"text") AND (("p"."id" = ANY ("events"."client")) OR ("p"."user" = ANY ("events"."client"))))))))))));
    $q$;
  END IF;
END
$do$;
