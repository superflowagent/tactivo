-- Enable row level security and create policies to match remote

-- Enable RLS on tables that are missing it
ALTER TABLE IF EXISTS public.classes_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for classes_templates
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'classes_templates' AND policyname = 'delete_classes_templates_by_professional'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "delete_classes_templates_by_professional" ON "public"."classes_templates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "classes_templates"."company") AND ("p"."role" = 'professional'::"text")))));
    $q$;
    EXECUTE $q$
    COMMENT ON POLICY "delete_classes_templates_by_professional" ON "public"."classes_templates" IS 'Allow professionals to delete class templates for their company';
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'classes_templates' AND policyname = 'insert_classes_templates_by_professional'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "insert_classes_templates_by_professional" ON "public"."classes_templates" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "classes_templates"."company") AND ("p"."role" = 'professional'::"text")))));
    $q$;
    EXECUTE $q$
    COMMENT ON POLICY "insert_classes_templates_by_professional" ON "public"."classes_templates" IS 'Allow professionals to insert class templates for their company';
    $q$;
  END IF;
END
$do$;

-- Create policies for companies
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'companies_select_company_members'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "companies_select_company_members" ON "public"."companies" FOR SELECT USING ("public"."is_profile_member_of"("id"));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'companies_select_member'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "companies_select_member" ON "public"."companies" FOR SELECT USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."company" = "companies"."id")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'companies_update_professional'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "companies_update_professional" ON "public"."companies" FOR UPDATE USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "companies"."id")))) ) WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'professional'::"text")))));
    $q$;
  END IF;
END
$do$;

-- Create policies for events
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_delete_company_members'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_delete_company_members" ON "public"."events" FOR DELETE USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "events"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_delete_professional_or_service'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_delete_professional_or_service" ON "public"."events" FOR DELETE USING ((("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "events"."company"))))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_insert_professional_or_service'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_insert_professional_or_service" ON "public"."events" FOR INSERT WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'professional'::"text"))))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_insert_professionals'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_insert_professionals" ON "public"."events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "p"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_delete'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_policy_delete" ON "public"."events" FOR DELETE USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "events"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_insert'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_policy_insert" ON "public"."events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['professional'::"text", 'admin'::"text"])) AND ("p"."company" = "p"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_select'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_policy_select" ON "public"."events" FOR SELECT USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "events"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_policy_update'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_policy_update" ON "public"."events" FOR UPDATE USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "events"."company"))))) WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "p"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_select_company_member'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_select_company_member" ON "public"."events" FOR SELECT USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."company" = "events"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_select_company_members'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_select_company_members" ON "public"."events" FOR SELECT USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "events"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_update_company_members'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_update_company_members" ON "public"."events" FOR UPDATE USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "events"."company"))))) WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."user" = "auth"."uid"()) AND ("p"."company" = "p"."company")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_update_professional_or_service'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "events_update_professional_or_service" ON "public"."events" FOR UPDATE USING ((("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "events"."company")))))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'professional'::"text"))))));
    $q$;
  END IF;
END
$do$;

-- Create policies for profiles
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete_professional_same_company_delete'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_delete_professional_same_company_delete" ON "public"."profiles" FOR DELETE USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p2"
      WHERE ((("p2"."user")::"text" = ("auth"."uid"())::"text") AND ("p2"."role" = 'professional'::"text") AND (("p2"."company")::"text" = ("profiles"."company")::"text")))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Delete own profile'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "Delete own profile" ON "public"."profiles" FOR DELETE USING ((("auth"."uid"() = "user") OR ("auth"."uid"() = "id")));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Enable insert for authenticated users only'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "Enable insert for authenticated users only" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (true);
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Select owner or company'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "Select owner or company" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "user") OR ("auth"."uid"() = "id") OR "public"."is_same_company"("company")));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_admins_or_professionals'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_update_admins_or_professionals" ON "public"."profiles" FOR UPDATE USING ((("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
       FROM "public"."profiles" "p"
      WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text")))))));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_self_or_service'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_update_self_or_service" ON "public"."profiles" FOR UPDATE USING (((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() = "user") OR ("auth"."uid"() = "id"))) OR "public"."is_same_company"("company"))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() = "user") OR ("auth"."uid"() = "id"))) OR "public"."is_same_company"("company"));
    $q$;
  END IF;
END
$do$;
