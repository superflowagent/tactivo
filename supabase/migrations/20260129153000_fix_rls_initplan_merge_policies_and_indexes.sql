-- Fix remaining auth.*()/current_setting() in RLS, consolidate multiple permissive policies, add FK indexes and drop unused indexes safely
BEGIN;

-- Part A: rewrite auth.*/current_setting calls in USING and WITH CHECK
DO $$
DECLARE
  r RECORD;
  using_expr text;
  check_expr text;
  new_using text;
  new_check text;
  roles text;
  cmd text;
BEGIN
  FOR r IN
    SELECT polname, polrelid::regclass AS relname, polcmd, pg_get_expr(polqual, polrelid) AS usingexpr, pg_get_expr(polwithcheck, polrelid) AS checkexpr
    FROM pg_policy
    WHERE pg_get_expr(polqual, polrelid) ~ 'auth\.|current_setting' OR pg_get_expr(polwithcheck, polrelid) ~ 'auth\.|current_setting'
  LOOP
    using_expr := r.usingexpr;
    check_expr := r.checkexpr;

    IF using_expr IS NOT NULL THEN
      new_using := using_expr;
      new_using := replace(new_using, '"auth"."uid"()', '(select auth.uid())::uuid');
      new_using := replace(new_using, 'auth.uid()', '(select auth.uid())::uuid');
      new_using := replace(new_using, 'auth.uid()::text', '((select auth.uid())::text)');
      new_using := replace(new_using, '"auth"."role"()', '(select auth.role())');
      new_using := replace(new_using, 'auth.role()', '(select auth.role())');
      new_using := regexp_replace(new_using, 'current_setting\(([^)]*)\)', '(select current_setting(\1))','g');
    ELSE
      new_using := NULL;
    END IF;

    IF check_expr IS NOT NULL THEN
      new_check := check_expr;
      new_check := replace(new_check, '"auth"."uid"()', '(select auth.uid())::uuid');
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())::uuid');
      new_check := replace(new_check, 'auth.uid()::text', '((select auth.uid())::text)');
      new_check := replace(new_check, '"auth"."role"()', '(select auth.role())');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
      new_check := regexp_replace(new_check, 'current_setting\(([^)]*)\)', '(select current_setting(\1))','g');
    ELSE
      new_check := NULL;
    END IF;

    -- Determine roles: keep existing role detection conservative: default to authenticated if auth used
    roles := 'authenticated';
    IF (COALESCE(new_using,'') ILIKE '%service_role%') OR (COALESCE(new_check,'') ILIKE '%service_role%') THEN
      roles := roles || ', service_role';
    END IF;

    cmd := CASE r.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN 'i' THEN 'INSERT'
      ELSE 'ALL'
    END;

    RAISE NOTICE 'Recreating policy % on %', r.polname, r.relname;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.relname);
    EXECUTE format('CREATE POLICY %I ON %s FOR %s TO %s %s %s', r.polname, r.relname, cmd, roles,
      CASE WHEN new_using IS NOT NULL THEN 'USING (' || new_using || ')' ELSE '' END,
      CASE WHEN new_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END);
  END LOOP;
END$$;

-- Part B: consolidate multiple permissive policies per table/role/action into a single combined policy
DO $$
DECLARE
  g RECORD;
  polname text;
  i int;
  combined_using text;
  combined_check text;
  rolelist text;
  newname text;
  cmd text;
  names text;
BEGIN
  FOR g IN
    SELECT polrelid::regclass AS relname, polcmd, array_agg(pg_policy.polname) AS names, array_agg(pg_get_expr(pg_policy.polqual,pg_policy.polrelid)) AS usings, array_agg(pg_get_expr(pg_policy.polwithcheck,pg_policy.polrelid)) AS checks, array_agg( (SELECT array_to_string(array_agg(rolname), ',') FROM pg_roles WHERE oid = ANY(pg_policy.polroles)) ) AS roles_arr
    FROM pg_policy
    GROUP BY polrelid, polcmd
    HAVING count(*) > 1
  LOOP
    -- Build OR'ed using expressions
    combined_using := NULL;
    combined_check := NULL;
    rolelist := '';
    names := array_to_string(g.names, ',');

    FOR i IN array_lower(g.usings,1)..array_upper(g.usings,1) LOOP
      IF g.usings[i] IS NOT NULL THEN
        IF combined_using IS NULL THEN
          combined_using := '(' || g.usings[i] || ')';
        ELSE
          combined_using := combined_using || ' OR (' || g.usings[i] || ')';
        END IF;
      END IF;
      IF g.checks[i] IS NOT NULL THEN
        IF combined_check IS NULL THEN
          combined_check := '(' || g.checks[i] || ')';
        ELSE
          combined_check := combined_check || ' OR (' || g.checks[i] || ')';
        END IF;
      END IF;

      -- collect roles (roles are stored as comma-separated strings in roles_arr)
      rolelist := rolelist || COALESCE(g.roles_arr[i],'') || ',';
    END LOOP;

    rolelist := trim(both ',' from regexp_replace(rolelist, ',+', ',', 'g'));
    IF rolelist = '' THEN rolelist := 'public'; END IF;

    cmd := CASE g.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN 'i' THEN 'INSERT'
      ELSE 'ALL'
    END;

    newname := 'combined_' || replace(g.relname::text, 'public.','') || '_' || cmd || '_' || md5(names);

    RAISE NOTICE 'Combining policies % on % cmd=% into %', names, g.relname, cmd, newname;

    -- Drop old policies and create a single combined one (idempotent)
    FOREACH polname IN ARRAY g.names LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', polname, g.relname);
    END LOOP;

    EXECUTE format('CREATE POLICY %I ON %s FOR %s TO %s %s %s', newname, g.relname, cmd, rolelist,
      CASE WHEN combined_using IS NOT NULL THEN 'USING (' || combined_using || ')' ELSE '' END,
      CASE WHEN combined_check IS NOT NULL THEN 'WITH CHECK (' || combined_check || ')' ELSE '' END);

  END LOOP;
END$$;

-- Part C: add missing covering indexes for foreign keys (non-concurrent; safe for local testing)
-- Indexes suggested by linter
CREATE INDEX IF NOT EXISTS idx_anatomy_company ON public.anatomy (company);
CREATE INDEX IF NOT EXISTS idx_equipment_company ON public.equipment (company);
CREATE INDEX IF NOT EXISTS idx_exercises_company ON public.exercises (company);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles (company);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON public.profiles ("user");
CREATE INDEX IF NOT EXISTS idx_program_exercises_exercise ON public.program_exercises (exercise);
CREATE INDEX IF NOT EXISTS idx_program_exercises_program ON public.program_exercises (program);
CREATE INDEX IF NOT EXISTS idx_programs_company ON public.programs (company);
CREATE INDEX IF NOT EXISTS idx_programs_profile ON public.programs (profile);

-- Part D: drop unused indexes if not scanned
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT schemaname, indexrelname FROM pg_stat_user_indexes WHERE (indexrelname IN ('classes_templates_company_idx','idx_events_company')) AND idx_scan = 0
  LOOP
    RAISE NOTICE 'Dropping unused index %.% ', rec.schemaname, rec.indexrelname;
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', rec.schemaname, rec.indexrelname);
  END LOOP;
END$$;

COMMIT;
