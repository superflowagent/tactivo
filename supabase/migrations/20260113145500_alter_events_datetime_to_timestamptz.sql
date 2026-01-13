-- Migration: alter events.datetime column to timestamptz if currently timestamp without time zone
DO $$
DECLARE cur_type text;
BEGIN
  SELECT data_type INTO cur_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'datetime';

  IF cur_type = 'timestamp without time zone' THEN
    RAISE NOTICE 'Altering column events.datetime from timestamp without time zone to timestamptz';
    ALTER TABLE public.events ALTER COLUMN datetime TYPE timestamptz USING (datetime::timestamptz);
  ELSE
    RAISE NOTICE 'events.datetime column already %', cur_type;
  END IF;
END;
$$ LANGUAGE plpgsql;