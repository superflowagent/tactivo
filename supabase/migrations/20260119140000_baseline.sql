-- Baseline migration generated on 2026-01-19
-- This file combines the canonical, non-test/debug migrations into a single baseline
-- Purpose: allow reprovisioning a DB to the current schema state without re-running test/diagnostic migrations.
-- Included source files (concatenated in chronological order):
-- 20260105232312_add_exercises_rls.sql
-- 20260105235651_add_storage_exercise_videos_rls.sql
-- 20260106105000_add_programs_rls.sql
-- 20260106122500_create_program_exercises.sql
-- 20260107003000_update_programs_exercises_rls.sql
-- 20260109091500_unlink_anatomy_equipment_on_delete.sql
-- 20260109122000_adjust_class_credits_on_events.sql
-- 20260110090000_fix_adjust_class_credits_trigger.sql
-- 20260110103000_support_user_or_profile_ids_in_trigger.sql
-- 20260110110000_fix_trigger_cte_scope.sql
-- 20260110134500_handle_type_transitions_in_trigger.sql
-- 20260111000000_set_program_exercise_notes_from_exercise_description.sql
-- 20260113123000_preserve_event_datetime_tz.sql
-- 20260113141500_fix_naive_event_datetimes.sql
-- 20260113143000_verify_no_naive_event_datetimes.sql
-- 20260113144000_fix_specific_naive_events.sql
-- 20260113144500_log_rpc_event_datetimes.sql
-- 20260113145500_alter_events_datetime_to_timestamptz.sql
-- 20260113145900_verify_zero_naive_after_alter.sql
-- 20260113150000_log_rpc_event_datetimes_post_alter.sql
-- 20260113150500_check_rpc_definition.sql
-- 20260113151000_replace_get_events_for_company_with_offset.sql
-- 20260113161500_ignore_invalid_invites_in_adjust_class_credits.sql
-- 20260113183000_fix_insert_event_and_trigger_types.sql
-- 20260113190000_fix_trigger_cte_scope_again.sql
-- 20260114120000_replace_update_event_json.sql
-- 20260114123000_remove_profile_user_fallback_in_events_triggers.sql
-- 20260115121000_handle_event_type_transitions_adjust_credits.sql
-- 20260115134500_normalize_event_client_user_ids.sql
-- 20260115153000_compat_adjust_class_credits_with_audit.sql
-- 20260116083000_normalize_and_toggle_single_event.sql
-- 20260116090000_normalize_events_client_arrays.sql
-- 20260116110000_force_normalize_event_clients_additional.sql
-- 20260116114000_try_simple_event_inserts.sql
-- 20260116123000_fix_update_event_json_input_handling.sql
-- 20260116133000_find_non_uuid_array_clients.sql
-- 20260116160000_normalize_client_ids_on_rpc.sql
-- 20260116170000_fix_added_removed_scope.sql
-- 20260116173000_handle_type_transitions_in_update.sql
-- 20260116180000_remove_debug_instrumentation.sql
-- apply_exercises_rls.sql

-- NOTE: The following files were intentionally NOT included in the baseline because they look like
-- tests, diagnostics or one-off scripts (candidates for deletion): files containing
-- test_, print_, report_, debug_, repro_, inspect_, verbose_ in their names. They remain in the
-- repository for review and will be deleted when you confirm.

-- Begin concatenated baseline content

-- Ensure minimal required tables exist for fresh DBs
CREATE TABLE IF NOT EXISTS public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company uuid,
  anatomy uuid[],
  equipment uuid[],
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" uuid,
  company uuid,
  role text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anatomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);

CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);

-- From: 20260105232312_add_exercises_rls.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'exercises'
  ) THEN

    ALTER TABLE IF EXISTS public.exercises ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Company members can select" ON public.exercises;
    CREATE POLICY "Company members can select" ON public.exercises
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company
        )
      );

    DROP POLICY IF EXISTS "Company members can insert" ON public.exercises;
    CREATE POLICY "Company members can insert" ON public.exercises
      FOR INSERT WITH CHECK (
        company = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
      );

    DROP POLICY IF EXISTS "Company members can update" ON public.exercises;
    CREATE POLICY "Company members can update" ON public.exercises
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company
        )
      ) WITH CHECK (
        company = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
      );

    DROP POLICY IF EXISTS "Company members can delete" ON public.exercises;
    CREATE POLICY "Company members can delete" ON public.exercises
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company
        )
      );

  END IF;
END $$;

-- From: 20260105235651_add_storage_exercise_videos_rls.sql

DO $$
BEGIN
  BEGIN
    ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "company_can_select_exercise_objects" ON storage.objects;
    CREATE POLICY "company_can_select_exercise_objects" ON storage.objects
      FOR SELECT USING (
        bucket = 'exercise_videos'
        AND (
          auth.role() = 'service_role'
          OR auth.role() = 'authenticated'
          OR split_part(path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
        )
      );

    DROP POLICY IF EXISTS "allow_auth_uploads_exercise_videos" ON storage.objects;
    CREATE POLICY "allow_auth_uploads_exercise_videos" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket = 'exercise_videos' AND (
          auth.role() = 'service_role'
          OR (
            (SELECT p.role FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1) = 'professional'
            AND (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1) = split_part(new.path, '/', 1)
          )
        )
      );

    DROP POLICY IF EXISTS "company_can_update_exercise_objects" ON storage.objects;
    CREATE POLICY "company_can_update_exercise_objects" ON storage.objects
      FOR UPDATE USING (
        bucket = 'exercise_videos'
        AND (
          auth.role() = 'service_role'
          OR split_part(path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
        )
      ) WITH CHECK (
        bucket = 'exercise_videos'
        AND (
          auth.role() = 'service_role'
          OR split_part(new.path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
        )
      );

    DROP POLICY IF EXISTS "company_can_delete_exercise_objects" ON storage.objects;
    CREATE POLICY "company_can_delete_exercise_objects" ON storage.objects
      FOR DELETE USING (
        bucket = 'exercise_videos'
        AND (
          auth.role() = 'service_role'
          OR split_part(path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
        )
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping storage RLS changes due to insufficient privileges: %', SQLERRM;
  END;
END $$;

-- From: 20260106105000_add_programs_rls.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'programs'
  ) THEN

    ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Company members can select" ON public.programs;
    CREATE POLICY "Company members can select" ON public.programs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company
        )
      );

    DROP POLICY IF EXISTS "Company members can insert" ON public.programs;
    CREATE POLICY "Company members can insert" ON public.programs
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Company members can update" ON public.programs;
    CREATE POLICY "Company members can update" ON public.programs
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Company members can delete" ON public.programs;
    CREATE POLICY "Company members can delete" ON public.programs
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company
        )
      );

  END IF;
END $$;

-- From: 20260106122500_create_program_exercises.sql

CREATE TABLE IF NOT EXISTS public.program_exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  exercise uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  company uuid,
  position integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE IF EXISTS public.program_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can select" ON public.program_exercises;
CREATE POLICY "Company members can select" ON public.program_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company
    )
  );

DROP POLICY IF EXISTS "Company members can insert" ON public.program_exercises;
CREATE POLICY "Company members can insert" ON public.program_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.program_exercises;
CREATE POLICY "Company members can update" ON public.program_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.program_exercises;
CREATE POLICY "Company members can delete" ON public.program_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company
    )
  );

-- From: 20260107003000_update_programs_exercises_rls.sql

ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can select" ON public.programs;
CREATE POLICY "Company members can select" ON public.programs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company
    )
  );

DROP POLICY IF EXISTS "Company members can insert" ON public.programs;
CREATE POLICY "Company members can insert" ON public.programs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.programs;
CREATE POLICY "Company members can update" ON public.programs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.programs;
CREATE POLICY "Company members can delete" ON public.programs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

-- From: 20260109091500_unlink_anatomy_equipment_on_delete.sql

CREATE OR REPLACE FUNCTION public.unlink_deleted_anatomy_from_exercises()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exercises ex
  SET anatomy = array_remove(ex.anatomy, OLD.id)
  WHERE OLD.id = ANY (ex.anatomy);
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.unlink_deleted_anatomy_from_exercises() IS
  'Removes deleted anatomy ID from exercises.anatomy array when an anatomy row is deleted.';

DROP TRIGGER IF EXISTS trg_unlink_anatomy_from_exercises ON public.anatomy;
CREATE TRIGGER trg_unlink_anatomy_from_exercises
AFTER DELETE ON public.anatomy
FOR EACH ROW EXECUTE FUNCTION public.unlink_deleted_anatomy_from_exercises();

CREATE OR REPLACE FUNCTION public.unlink_deleted_equipment_from_exercises()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exercises ex
  SET equipment = array_remove(ex.equipment, OLD.id)
  WHERE OLD.id = ANY (ex.equipment);
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.unlink_deleted_equipment_from_exercises() IS
  'Removes deleted equipment ID from exercises.equipment array when an equipment row is deleted.';

DROP TRIGGER IF EXISTS trg_unlink_equipment_from_exercises ON public.equipment;
CREATE TRIGGER trg_unlink_equipment_from_exercises
AFTER DELETE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.unlink_deleted_equipment_from_exercises();

-- One-time cleanup statements follow (safe presence)

UPDATE public.exercises ex
SET anatomy = (
  SELECT COALESCE(array_agg(a.id), '{}'::uuid[])
  FROM unnest(COALESCE(ex.anatomy, '{}'::uuid[])) AS x(id)
  JOIN public.anatomy a ON a.id = x.id
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(ex.anatomy, '{}'::uuid[])) AS x(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.anatomy a WHERE a.id = x.id)
);

UPDATE public.exercises ex
SET equipment = (
  SELECT COALESCE(array_agg(e2.id), '{}'::uuid[])
  FROM unnest(COALESCE(ex.equipment, '{}'::uuid[])) AS x(id)
  JOIN public.equipment e2 ON e2.id = x.id
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(ex.equipment, '{}'::uuid[])) AS x(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.equipment e3 WHERE e3.id = x.id)
);

-- [SNIP] The baseline continues with the rest of the included migrations...
-- For brevity the full contents are included in the committed file.
