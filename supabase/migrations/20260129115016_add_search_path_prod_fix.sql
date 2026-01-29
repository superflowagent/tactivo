-- Make search_path explicit for SECURITY DEFINER functions and tighten profiles INSERT RLS
BEGIN;

-- Each ALTER wrapped to ignore missing functions (idempotent and safe on remote)
DO $$ BEGIN
  BEGIN
    ALTER FUNCTION public.get_profile_by_user(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.debug_get_caller_info() SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.debug_list_pg_triggers_profiles() SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.debug_list_profiles_triggers() SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.delete_event_json(jsonb) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.fn_set_program_exercise_notes() SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_company_by_id(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_event_attendee_profiles(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_events_for_company(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_profiles_by_role_for_clients(text) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_profiles_by_role_for_clients(text, uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.is_professional_of_company(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.is_same_company(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.is_member_of_company(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.accept_invite_debug(text) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.accept_invite(text) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.accept_invite(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.accept_invite_http(text) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.accept_invite_verbose(text) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.adjust_class_credits_on_events_change() SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.as_uuid_array(anyelement) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.create_auth_user_for_profile() SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.dbg_accept_invite_sim(uuid, uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_profiles_by_ids_for_clients(uuid[]) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_profiles_by_ids_for_professionals(uuid[]) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_profiles_by_role_for_professionals(text) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_profiles_by_role_for_professionals(text, uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.get_profiles_for_professionals() SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.insert_event_json(jsonb) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.is_profile_admin_of(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.is_profile_member_of(uuid) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN
    ALTER FUNCTION public.update_event_json(jsonb) SET search_path = 'public, pg_temp';
  EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;

-- Tighten profiles INSERT RLS (idempotent)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (("user" = auth.uid()) OR ("user" IS NULL));

COMMIT;
