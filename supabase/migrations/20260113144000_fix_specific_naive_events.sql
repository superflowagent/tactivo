-- Fix specific naive event rows (observed during diagnostics)
BEGIN;

UPDATE events
SET datetime = (datetime::text)::timestamptz
WHERE id IN (
  '8218e2c4-d182-441b-8e85-6f8d4aad5e21',
  'a81a14c4-4a09-40ca-9ae7-513510c84720',
  '3367d622-c9da-407a-aea5-cf2437a2f6c2'
);

-- Show post-update values
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN SELECT id, type, to_char(datetime,'YYYY-MM-DD"T"HH24:MI:SSOF') AS dt FROM events WHERE id IN (
    '8218e2c4-d182-441b-8e85-6f8d4aad5e21',
    'a81a14c4-4a09-40ca-9ae7-513510c84720',
    '3367d622-c9da-407a-aea5-cf2437a2f6c2'
  ) LOOP
    RAISE NOTICE 'updated_event: id=% type=% dt=%', rec.id, rec.type, rec.dt;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;