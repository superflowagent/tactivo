-- Migration: preserve datetime timezone and return datetimes with offset
-- 1) Add trigger to normalize incoming datetimes to timestamptz when inserting/updating events
-- 2) Replace get_events_for_company to return datetime as ISO with timezone offset

BEGIN;

-- 1) Trigger function to coerce NEW.datetime into timestamptz when possible
CREATE OR REPLACE FUNCTION public.normalize_event_datetime_tz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.datetime IS NOT NULL THEN
    -- If datetime is already a timestamptz, keep it
    -- Otherwise try to cast the textual representation to timestamptz.
    -- This preserves offsets when present and interprets naive datetimes as local wall-clock
    BEGIN
      NEW.datetime = (NEW.datetime::text)::timestamptz;
    EXCEPTION WHEN others THEN
      -- If cast fails, leave value unchanged and allow other validations to catch it
      NEW.datetime = NEW.datetime;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger before insert or update
DROP TRIGGER IF EXISTS trg_normalize_event_datetime_tz ON public.events;
CREATE TRIGGER trg_normalize_event_datetime_tz
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.normalize_event_datetime_tz();

-- 2) Replace get_events_for_company: ensure returned datetime contains timezone offset (ISO 8601)
-- Note: this is a defensive replacement; adapt fields as needed for your RPC contract.
DROP FUNCTION IF EXISTS public.get_events_for_company(uuid);

CREATE OR REPLACE FUNCTION public.get_events_for_company(p_company uuid)
RETURNS TABLE(
  id uuid,
  type text,
  datetime text,
  duration integer,
  "company" uuid,
  client jsonb,
  professional jsonb,
  cost numeric,
  paid boolean,
  notes text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.type,
    to_char(e.datetime, 'YYYY-MM-DD"T"HH24:MI:SSOF') as datetime,
    e.duration,
    e.company,
    to_jsonb(e.client) as client,
    to_jsonb(e.professional) as professional,
    e.cost,
    e.paid,
    e.notes
  FROM public.events e
  WHERE e.company = p_company
  ORDER BY e.datetime ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
