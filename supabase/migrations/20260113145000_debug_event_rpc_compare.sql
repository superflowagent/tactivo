-- Debug: compare stored event datetime and RPC output for specific events
DO $$
DECLARE
  rec record;
  r record;
BEGIN
  FOR rec IN SELECT id, company, to_char(datetime,'YYYY-MM-DD"T"HH24:MI:SSOF') AS stored_dt, pg_typeof(datetime)::text AS type FROM events WHERE id IN (
    '8218e2c4-d182-441b-8e85-6f8d4aad5e21',
    'a81a14c4-4a09-40ca-9ae7-513510c84720',
    '3367d622-c9da-407a-aea5-cf2437a2f6c2'
  ) LOOP
    RAISE NOTICE 'stored_event: id=% type=% stored_dt=%', rec.id, rec.type, rec.stored_dt;

    FOR r IN SELECT * FROM get_events_for_company(rec.company::uuid) WHERE id = rec.id LOOP
      RAISE NOTICE 'rpc_event_found: id=% rpc_datetime=%', rec.id, r.datetime;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM get_events_for_company(rec.company::uuid) WHERE id = rec.id) THEN
      RAISE NOTICE 'rpc_event_missing: id=%', rec.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;