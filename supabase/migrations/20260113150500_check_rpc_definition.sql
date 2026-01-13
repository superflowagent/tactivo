-- Check that get_events_for_company function contains to_char(e.datetime, 'YYYY-MM-DD"T"HH24:MI:SSOF') and verify it returns events
DO $$
DECLARE
  def text;
  found boolean := false;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p WHERE p.proname = 'get_events_for_company' LIMIT 1;
  IF def IS NULL THEN
    RAISE NOTICE 'get_events_for_company: not found';
  ELSE
    found := def LIKE '%to_char(e.datetime, ''YYYY-MM-DD"T"HH24:MI:SSOF'')%';
    RAISE NOTICE 'get_events_for_company_contains_to_char=%', found;
    -- show a snippet
    RAISE NOTICE 'fn_snippet=%', left(def, 800);
  END IF;
END;
$$ LANGUAGE plpgsql;