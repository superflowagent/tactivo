-- Migration: normalize events.client values to uuid[] and avoid trigger execution during update
-- Drops `trg_adjust_class_credits` temporarily, coerces scalar `client` values into arrays using `public.as_uuid_array`, logs count, and recreates the trigger.

BEGIN;

-- Temporarily remove trigger to avoid executing credit adjustment logic while we normalize stored values
DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;

-- Normalize client column to uuid[] for rows that are not already uuid[]
WITH updated AS (
  UPDATE public.events
  SET client = public.as_uuid_array(client)
  WHERE client IS NOT NULL
    AND pg_typeof(client)::text <> 'uuid[]'
  RETURNING id
)
INSERT INTO public.adjust_class_credits_audit(op, note, delta)
SELECT 'normalize-client-arrays', format('normalized %s events', COUNT(*)), COUNT(*) FROM updated;

-- Recreate the trigger to restore normal behavior
CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();

COMMIT;
