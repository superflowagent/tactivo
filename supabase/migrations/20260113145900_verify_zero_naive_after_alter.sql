-- Verification: ensure no events remain with timestamp without time zone
DO $$
DECLARE cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM events WHERE pg_typeof(datetime)::text = 'timestamp without time zone' AND datetime IS NOT NULL;
  RAISE NOTICE 'naive_event_datetime_count_after_alter=%', cnt;
END;
$$ LANGUAGE plpgsql;