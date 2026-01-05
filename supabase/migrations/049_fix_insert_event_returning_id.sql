-- Migration: Fix ambiguous 'id' reference in insert_event_json RETURNING clause

BEGIN;

CREATE OR REPLACE FUNCTION public.insert_event_json(p_payload jsonb)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER AS $$
DECLARE
  v_type text := p_payload->>'type';
  v_duration int := NULLIF(p_payload->>'duration','')::int;
  v_cost numeric := NULLIF(p_payload->>'cost','')::numeric;
  v_paid boolean := (p_payload->>'paid')::boolean;
  v_notes text := p_payload->>'notes';
  v_datetime text := p_payload->>'datetime';
  v_client uuid[] := ARRAY[]::uuid[];
  v_professional uuid[] := ARRAY[]::uuid[];
  v_company uuid := NULLIF(p_payload->>'company','')::uuid;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'company is required';
  END IF;

  -- Only professionals of the company can insert events
  IF NOT public.is_professional_of_company(v_company) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF p_payload ? 'client' THEN
    SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_client
    FROM jsonb_array_elements_text(p_payload->'client') AS x;
  END IF;

  IF p_payload ? 'professional' THEN
    SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_professional
    FROM jsonb_array_elements_text(p_payload->'professional') AS x;
  END IF;

  RETURN QUERY
    INSERT INTO public.events (type, duration, cost, paid, notes, datetime, client, professional, company)
    VALUES (v_type, v_duration, v_cost, v_paid, v_notes, v_datetime::timestamptz, v_client, v_professional, v_company)
    RETURNING public.events.id AS id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_event_json(jsonb) TO authenticated;

COMMIT;