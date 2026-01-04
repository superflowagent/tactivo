-- Migration: Add JSON payload wrapper for insert_event to avoid PostgREST signature issues

BEGIN;

CREATE OR REPLACE FUNCTION public.insert_event_json(p_payload jsonb)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_type text := p_payload->>'type';
  v_duration int := (p_payload->>'duration')::int;
  v_cost numeric := NULLIF(p_payload->>'cost','')::numeric;
  v_paid boolean := (p_payload->>'paid')::boolean;
  v_notes text := p_payload->>'notes';
  v_datetime text := p_payload->>'datetime';
  v_client uuid[] := (SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) FROM jsonb_array_elements_text(p_payload->'client') x);
  v_professional uuid[] := (SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) FROM jsonb_array_elements_text(p_payload->'professional') x);
  v_company uuid := (p_payload->>'company')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.role = 'professional'
      AND p.company::text = v_company::text
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  RETURN QUERY
    INSERT INTO public.events (type, duration, cost, paid, notes, datetime, client, professional, company)
    VALUES (v_type, v_duration, v_cost, v_paid, v_notes, v_datetime::timestamptz, coalesce(v_client, ARRAY[]::uuid[]), coalesce(v_professional, ARRAY[]::uuid[]), v_company)
    RETURNING id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_event_json(jsonb) TO authenticated;

COMMIT;
