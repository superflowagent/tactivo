-- Diagnostic: find any table/action/role that still has more than one policy (should be zero after merges)
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Checking for remaining duplicates (rel, polcmd, role, count)';
  FOR r IN
    SELECT p.polrelid::regclass AS relname, p.polcmd AS polcmd, rol.rolname AS role, count(*) AS cnt
    FROM pg_policy p
    JOIN LATERAL unnest(p.polroles) AS r2(oid) ON true
    JOIN pg_roles rol ON rol.oid = r2.oid
    GROUP BY p.polrelid, p.polcmd, rol.rolname
    HAVING count(*) > 1
  LOOP
    RAISE NOTICE '% | % | % | %', r.relname, r.polcmd, r.role, r.cnt;
  END LOOP;
END$$;
