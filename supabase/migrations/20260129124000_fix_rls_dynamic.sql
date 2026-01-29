-- Programmatically replace auth.<func>() calls in RLS policies with (select auth.<func>()) and add explicit TO clauses when safe
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
    WHERE pg_get_expr(polqual, polrelid) ~ 'auth\\.' OR pg_get_expr(polwithcheck, polrelid) ~ 'auth\\.'
  LOOP
    using_expr := r.usingexpr;
    check_expr := r.checkexpr;

    -- perform safe textual replacements for common auth calls
    IF using_expr IS NOT NULL THEN
      new_using := replace(using_expr, '"auth"."uid"()', '(select auth.uid())::uuid');
      new_using := replace(new_using, 'auth.uid()', '(select auth.uid())::uuid');
      new_using := replace(new_using, '"auth"."role"()', '(select auth.role())');
      new_using := replace(new_using, 'auth.role()', '(select auth.role())');
    ELSE
      new_using := NULL;
    END IF;

    IF check_expr IS NOT NULL THEN
      new_check := replace(check_expr, '"auth"."uid"()', '(select auth.uid())::uuid');
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())::uuid');
      new_check := replace(new_check, '"auth"."role"()', '(select auth.role())');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
    ELSE
      new_check := NULL;
    END IF;

    -- determine roles: default to authenticated if auth.* used; also include service_role if present
    roles := 'authenticated';
    IF (COALESCE(new_using,'') LIKE '%service_role%') OR (COALESCE(new_check,'') LIKE '%service_role%') THEN
      roles := roles || ', service_role';
    END IF;

    -- map polcmd to SQL keywords
    cmd := CASE r.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN 'i' THEN 'INSERT'
      ELSE 'ALL'
    END;

    -- Drop and recreate policy with adjusted expressions and explicit roles
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.relname);
    EXECUTE format('CREATE POLICY %I ON %s FOR %s TO %s %s %s', r.polname, r.relname, cmd, roles,
      CASE WHEN new_using IS NOT NULL THEN 'USING (' || new_using || ')' ELSE '' END,
      CASE WHEN new_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END);
  END LOOP;
END$$;

COMMIT;