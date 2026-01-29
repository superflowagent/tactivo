-- Diagnostic: list polname, polrelid::regclass, polcmd for tables that still show multiple policies per role+action
DO $$
DECLARE
  r RECORD;
  tbls TEXT[] := ARRAY['anatomy','classes_templates','equipment','events','exercises','profiles','program_exercises','programs'];
BEGIN
  RAISE NOTICE 'Listing policies (polname, rel, polcmd, roles) for diagnostic';
  FOR r IN
    SELECT polname, polrelid::regclass AS relname, polcmd, polroles
    FROM pg_policy
    WHERE polrelid::regclass::text LIKE 'public.%' AND (polrelid::regclass::text = ANY(ARRAY(SELECT 'public.'||t FROM unnest(tbls) t)))
    ORDER BY relname, polname
  LOOP
    RAISE NOTICE '% | % | % | %', r.polname, r.relname, r.polcmd, r.polroles;
  END LOOP;
END$$;
