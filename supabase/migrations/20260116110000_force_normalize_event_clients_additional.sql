-- Migration: force-normalize event.client values handling scalar, quoted array literals and other types
-- Temporarily drop trigger, run robust normalization, log count, recreate trigger

BEGIN;

DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;

WITH upd AS (
  UPDATE public.events e
  SET client = (
    SELECT CASE
      WHEN pg_typeof(e.client)::text = 'uuid[]' THEN e.client
      WHEN pg_typeof(e.client)::text IN ('text','varchar') AND e.client::text LIKE '{%' THEN (
        SELECT coalesce(array_agg((m[1])::uuid), ARRAY[]::uuid[]) FROM regexp_matches(e.client::text, '([0-9a-fA-F-]{36})','g') m
      )
      WHEN pg_typeof(e.client)::text IN ('text','varchar') THEN (
        SELECT ARRAY[NULLIF(e.client::text,'')::uuid]
      )
      ELSE public.as_uuid_array(e.client)
    END
    )
  WHERE e.client IS NOT NULL
  RETURNING e.id
)
INSERT INTO public.adjust_class_credits_audit(op, note, delta)
SELECT 'force-normalize-client', format('normalized %s events', COUNT(*)), COUNT(*) FROM upd;

CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();

COMMIT;