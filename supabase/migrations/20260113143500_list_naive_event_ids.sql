-- Debug migration: list ids and types of events still with naive datetimes
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id, type, to_char(datetime,'YYYY-MM-DD"T"HH24:MI:SS') AS dt
    FROM events
    WHERE pg_typeof(datetime)::text = 'timestamp without time zone' AND datetime IS NOT NULL
  LOOP
    RAISE NOTICE 'naive_event: id=% type=% dt=%', rec.id, rec.type, rec.dt;
  END LOOP;
END;
$$ LANGUAGE plpgsql;