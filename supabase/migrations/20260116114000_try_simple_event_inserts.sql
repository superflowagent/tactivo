-- Migration: try simple inserts with array literal and array constructor
DO $$
BEGIN
  -- Using array constructor
  INSERT INTO public.events (type, datetime, client, company)
  VALUES ('class', now(), ARRAY['00000000-0000-0000-0000-000000000033']::uuid[], (SELECT id FROM public.companies LIMIT 1));
  RAISE NOTICE 'inserted with ARRAY constructor';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'failed_array_constructor: %', SQLERRM;
END$$;

DO $$
BEGIN
  -- Using array literal
  INSERT INTO public.events (type, datetime, client, company)
  VALUES ('class', now(), '{00000000-0000-0000-0000-000000000044}'::uuid[], (SELECT id FROM public.companies LIMIT 1));
  RAISE NOTICE 'inserted with array literal';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'failed_array_literal: %', SQLERRM;
END$$;