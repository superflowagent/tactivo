-- Migration: report information_schema for events.client and events table
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'events' AND column_name IN ('client','professional') LOOP
    RAISE NOTICE 'COLINFO: % % %', rec.column_name, rec.data_type, rec.udt_name;
  END LOOP;
END$$;