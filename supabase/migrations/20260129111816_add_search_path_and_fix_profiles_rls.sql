-- Add explicit search_path to SECURITY DEFINER functions and tighten RLS policy for profiles
BEGIN;

-- Add SET search_path to functions (idempotent via ALTER FUNCTION)
ALTER FUNCTION public.accept_invite(text) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.accept_invite(uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.accept_invite_debug(text) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.accept_invite_http(text) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.accept_invite_verbose(text) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.adjust_class_credits_on_events_change() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.as_uuid_array(anyelement) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.create_auth_user_for_profile() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.dbg_accept_invite_sim(uuid, uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.debug_get_caller_info() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.debug_list_pg_triggers_profiles() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.debug_list_profiles_triggers() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.delete_event_json(jsonb) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.fn_set_program_exercise_notes() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_company_by_id(uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_event_attendee_profiles(uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_events_for_company(uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profile_by_user(uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_ids_for_clients(uuid[]) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_ids_for_clients(uuid[], uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_ids_for_professionals(uuid[]) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_role_for_clients() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_role_for_professionals() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_for_professionals() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.is_profile_member_of(uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.is_same_company(uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.insert_event_json(jsonb) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_ids_for_professionals(uuid[], uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_role_for_professionals() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_by_role_for_clients() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.get_profiles_for_professionals() SET search_path = 'public, pg_temp';
ALTER FUNCTION public.insert_event_json(jsonb) SET search_path = 'public, pg_temp';

-- Tighten RLS for profiles (idempotent)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (("user" = auth.uid()) OR ("user" IS NULL));

COMMIT;
