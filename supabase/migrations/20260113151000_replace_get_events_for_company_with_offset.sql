-- Replace get_events_for_company so datetime is returned as ISO text with an explicit timezone offset
DROP FUNCTION IF EXISTS public.get_events_for_company(uuid);

CREATE OR REPLACE FUNCTION public.get_events_for_company(p_company uuid)
RETURNS TABLE(
  id uuid,
  company uuid,
  datetime text,
  duration integer,
  type text,
  client uuid[],
  professional uuid[],
  notes text,
  cost numeric,
  paid boolean
) AS $$
  SELECT
    e.id,
    e.company,
    to_char(e.datetime, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS datetime,
    e.duration,
    e.type,
    e.client,
    e.professional,
    e.notes,
    e.cost,
    e.paid
  FROM public.events e
  JOIN public.profiles p ON p."user" = auth.uid()
  WHERE e.company = p.company
  ORDER BY e.datetime ASC;
$$ LANGUAGE sql SECURITY DEFINER;