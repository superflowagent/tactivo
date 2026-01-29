-- Normalize single-level SELECT wrappers like (SELECT "auth"."uid"() AS "uid") to (select auth.uid())::uuid
BEGIN;

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
    WHERE pg_get_expr(polqual, polrelid) ~ 'SELECT\s+"?auth"?\.?"?uid"?\(\)\s+AS\s+"?uid"?' OR pg_get_expr(polwithcheck, polrelid) ~ 'SELECT\s+"?auth"?\.?"?uid"?\(\)\s+AS\s+"?uid"?'
  LOOP
    using_expr := r.usingexpr;
    check_expr := r.checkexpr;

    IF using_expr IS NOT NULL THEN
      new_using := using_expr;
      new_using := regexp_replace(new_using, '\(\s*SELECT\s+"?auth"?\.?"?uid"?\(\)\s+AS\s+"?uid"?\s*\)', '(select auth.uid())::uuid','gi');
      new_using := regexp_replace(new_using, '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)', '(select auth.uid())::uuid','gi');
      new_using := regexp_replace(new_using, '\(\s*SELECT\s+"?auth"?\.?"?role"?\(\)\s+AS\s+"?role"?\s*\)', '(select auth.role())','gi');
    ELSE
      new_using := NULL;
    END IF;

    IF check_expr IS NOT NULL THEN
      new_check := check_expr;
      new_check := regexp_replace(new_check, '\(\s*SELECT\s+"?auth"?\.?"?uid"?\(\)\s+AS\s+"?uid"?\s*\)', '(select auth.uid())::uuid','gi');
      new_check := regexp_replace(new_check, '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)', '(select auth.uid())::uuid','gi');
      new_check := regexp_replace(new_check, '\(\s*SELECT\s+"?auth"?\.?"?role"?\(\)\s+AS\s+"?role"?\s*\)', '(select auth.role())','gi');
    ELSE
      new_check := NULL;
    END IF;

    IF new_using IS NOT NULL OR new_check IS NOT NULL THEN
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

      RAISE NOTICE 'Normalizing simple auth selects for % on %', r.polname, r.relname;
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.relname);
      EXECUTE format('CREATE POLICY %I ON %s FOR %s TO %s %s %s', r.polname, r.relname, cmd, roles,
        CASE WHEN new_using IS NOT NULL THEN 'USING (' || new_using || ')' ELSE '' END,
        CASE WHEN new_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END);
    END IF;

  END LOOP;
END$$;

COMMIT;
