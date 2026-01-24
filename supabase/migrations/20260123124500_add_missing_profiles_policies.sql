-- Idempotent migration: add missing policies on profiles to match remote

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Update own profile'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "Update own profile" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "user") OR ("auth"."uid"() = "id"))) WITH CHECK ((("auth"."uid"() = "user") OR ("auth"."uid"() = "id")));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_policy_delete_admins'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_policy_delete_admins" ON "public"."profiles" FOR DELETE USING ("public"."is_profile_admin_of"("company"));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_policy_select_company_members'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_policy_select_company_members" ON "public"."profiles" FOR SELECT USING ((("user" = "auth"."uid"()) OR "public"."is_profile_member_of"("company")));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_policy_update_company_members'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_policy_update_company_members" ON "public"."profiles" FOR UPDATE USING (("public"."is_profile_member_of"("company") OR ("user" = "auth"."uid"()))) WITH CHECK (("public"."is_profile_member_of"("company") OR ("user" = "auth"."uid"())));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"())::"text" = (USER)::"text")) WITH CHECK ((("auth"."uid"())::"text" = (USER)::"text"));
    $q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_professional_same_company_update'
  ) THEN
    EXECUTE $q$
    CREATE POLICY "profiles_update_professional_same_company_update" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p2"
      WHERE ((("p2"."user")::"text" = ("auth"."uid"())::"text") AND ("p2"."role" = 'professional'::"text") AND (("p2"."company")::"text" = ("profiles"."company")::"text")))) ) WITH CHECK ((EXISTS ( SELECT 1
       FROM "public"."profiles" "p2"
      WHERE ((("p2"."user")::"text" = ("auth"."uid"())::"text") AND ("p2"."role" = 'professional'::"text") AND (("p2"."company")::"text" = ("profiles"."company")::"text")))));
    $q$;
  END IF;
END
$do$;
