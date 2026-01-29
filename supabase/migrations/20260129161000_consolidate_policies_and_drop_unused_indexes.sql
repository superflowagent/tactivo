-- Consolidate multiple permissive policies per table/role/action, add missing FK indexes, and drop unused indexes automatically
BEGIN;

-- Part A: For each table and action, combine policies that apply to the same role into a single policy
DO $$
DECLARE
  rel RECORD;
  action CHAR;
  action_sql TEXT;
  role_rec RECORD;
  pol_rec RECORD;
  names TEXT;
  combined_using TEXT;
  combined_check TEXT;
  newname TEXT;
  cnt INT;
BEGIN
  FOR rel IN SELECT DISTINCT polrelid FROM pg_policy LOOP
    FOR action IN SELECT unnest(ARRAY['r'::char,'i'::char,'w'::char,'d'::char]) LOOP
      action_sql := CASE action WHEN 'r' THEN 'SELECT' WHEN 'i' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END;

      -- find all roles that appear in policies for this rel/action (including policies defined as ALL via polcmd='a')
      FOR role_rec IN
        SELECT DISTINCT pg_roles.oid AS oid, pg_roles.rolname AS rolname
        FROM pg_policy pol
        JOIN LATERAL unnest(pol.polroles) AS role_oid(oid) ON true
        JOIN pg_roles ON pg_roles.oid = role_oid.oid
        WHERE pol.polrelid = rel.polrelid AND pol.polcmd IN (action, 'a')
      LOOP
        -- collect policies that apply to this role and to this action (or ALL)
        combined_using := NULL;
        combined_check := NULL;
        names := NULL;
        cnt := 0;

        FOR pol_rec IN
          SELECT polname, pg_get_expr(polqual, polrelid) AS usingexpr, pg_get_expr(polwithcheck, polrelid) AS checkexpr
          FROM pg_policy
          WHERE polrelid = rel.polrelid AND (role_rec.oid = ANY(polroles)) AND polcmd IN (action, 'a')
        LOOP
          cnt := cnt + 1;
          IF pol_rec.usingexpr IS NOT NULL THEN
            IF combined_using IS NULL THEN
              combined_using := '(' || pol_rec.usingexpr || ')';
            ELSE
              combined_using := combined_using || ' OR (' || pol_rec.usingexpr || ')';
            END IF;
          END IF;

          IF pol_rec.checkexpr IS NOT NULL THEN
            IF combined_check IS NULL THEN
              combined_check := '(' || pol_rec.checkexpr || ')';
            ELSE
              combined_check := combined_check || ' OR (' || pol_rec.checkexpr || ')';
            END IF;
          END IF;

          names := COALESCE(names || ',', '') || pol_rec.polname;
        END LOOP;

        IF cnt > 1 THEN
          newname := format('consolidated_%s_%s_%s', replace(rel.polrelid::regclass::text, 'public.', ''), action_sql, md5(names));
          RAISE NOTICE 'Consolidating % policies on % for role % into %', cnt, rel.polrelid::regclass, role_rec.rolname, newname;

          -- drop old policies
          FOR pol_rec IN
            SELECT polname FROM pg_policy WHERE polrelid = rel.polrelid AND (role_rec.oid = ANY(polroles)) AND polcmd IN (action, 'a')
          LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol_rec.polname, rel.polrelid::regclass);
          END LOOP;

          -- create combined policy for this role and action
          EXECUTE format('CREATE POLICY %I ON %s FOR %s TO %I %s %s', newname, rel.polrelid::regclass, action_sql, role_rec.rolname,
            CASE WHEN combined_using IS NOT NULL THEN 'USING (' || combined_using || ')' ELSE '' END,
            CASE WHEN combined_check IS NOT NULL THEN 'WITH CHECK (' || combined_check || ')' ELSE '' END);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END$$;

-- Part B: Add indexes for foreign keys reported as unindexed
CREATE INDEX IF NOT EXISTS idx_classes_templates_company ON public.classes_templates (company);
CREATE INDEX IF NOT EXISTS idx_classes_templates_company1 ON public.classes_templates (company);
CREATE INDEX IF NOT EXISTS idx_events_company ON public.events (company);

-- Part C: Drop unused indexes automatically (if idx_scan = 0)
DO $$
DECLARE
  rec RECORD;
  candidates TEXT[] := ARRAY[
    'idx_profiles_company','idx_profiles_user','idx_anatomy_company','idx_equipment_company',
    'idx_exercises_company','idx_program_exercises_exercise','idx_program_exercises_program','idx_programs_company','idx_programs_profile'
  ];
BEGIN
  FOR rec IN
    SELECT schemaname, indexrelname
    FROM pg_stat_user_indexes
    WHERE indexrelname = ANY(candidates) AND idx_scan = 0
  LOOP
    RAISE NOTICE 'Dropping unused index %.%', rec.schemaname, rec.indexrelname;
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', rec.schemaname, rec.indexrelname);
  END LOOP;
END$$;

COMMIT;


