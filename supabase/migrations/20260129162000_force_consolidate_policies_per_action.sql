-- Force consolidate ALL + per-action policies into a single policy per table+action
BEGIN;

DO $$
DECLARE
  rel RECORD;
  action CHAR;
  action_sql TEXT;
  pol RECORD;
  roles TEXT;
  names TEXT;
  combined_using TEXT;
  combined_check TEXT;
  newname TEXT;
  cnt INT;
  role_oids OID[];
BEGIN
  FOR rel IN SELECT DISTINCT polrelid FROM pg_policy LOOP
    FOR action IN SELECT unnest(ARRAY['r'::char,'i'::char,'w'::char,'d'::char]) LOOP
      action_sql := CASE action WHEN 'r' THEN 'SELECT' WHEN 'i' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END;

      names := NULL;
      combined_using := NULL;
      combined_check := NULL;
      roles := NULL;
      role_oids := ARRAY[]::OID[];
      cnt := 0;

      FOR pol IN
        SELECT polname, pg_get_expr(polqual, polrelid) AS usingexpr, pg_get_expr(polwithcheck, polrelid) AS checkexpr, polroles
        FROM pg_policy
        WHERE polrelid = rel.polrelid AND polcmd IN (action, 'a')
      LOOP
        cnt := cnt + 1;
        -- aggregate using/check
        IF pol.usingexpr IS NOT NULL THEN
          IF combined_using IS NULL THEN
            combined_using := '(' || pol.usingexpr || ')';
          ELSE
            combined_using := combined_using || ' OR (' || pol.usingexpr || ')';
          END IF;
        END IF;
        IF pol.checkexpr IS NOT NULL THEN
          IF combined_check IS NULL THEN
            combined_check := '(' || pol.checkexpr || ')';
          ELSE
            combined_check := combined_check || ' OR (' || pol.checkexpr || ')';
          END IF;
        END IF;

        -- collect role oids
        IF pol.polroles IS NOT NULL THEN
          role_oids := role_oids || pol.polroles;
        END IF;

        names := COALESCE(names || ',', '') || pol.polname;
      END LOOP;

      IF cnt > 1 THEN
        -- uniq role_oids and map to names
        role_oids := (SELECT array_agg(distinct oid) FROM unnest(role_oids) oid(oid));
        IF role_oids IS NULL OR array_length(role_oids,1) = 0 THEN
          roles := 'public';
        ELSE
          SELECT string_agg(rolname, ',') INTO roles FROM pg_roles WHERE oid = ANY(role_oids);
        END IF;

        newname := format('forced_consolidated_%s_%s_%s', replace(rel.polrelid::regclass::text, 'public.', ''), action_sql, md5(names));
        RAISE NOTICE 'Force consolidating % policies on % into % for action % roles %', cnt, rel.polrelid::regclass, newname, action_sql, roles;

        -- drop old policies
        FOR pol IN
          SELECT polname FROM pg_policy WHERE polrelid = rel.polrelid AND polcmd IN (action, 'a')
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol.polname, rel.polrelid::regclass);
        END LOOP;

        -- create single combined policy
        EXECUTE format('CREATE POLICY %I ON %s FOR %s TO %s %s %s', newname, rel.polrelid::regclass, action_sql,
          CASE WHEN roles IS NULL THEN 'public' ELSE roles END,
          CASE WHEN combined_using IS NOT NULL THEN 'USING (' || combined_using || ')' ELSE '' END,
          CASE WHEN combined_check IS NOT NULL THEN 'WITH CHECK (' || combined_check || ')' ELSE '' END);
      END IF;

    END LOOP;
  END LOOP;
END$$;

COMMIT;
