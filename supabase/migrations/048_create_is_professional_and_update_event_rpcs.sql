-- Migration: Create helper is_professional_of_company (SECURITY DEFINER) and update event RPCs to use it

BEGIN;

-- Helper: returns true if current auth user is professional of given company
CREATE OR REPLACE FUNCTION public.is_professional_of_company(p_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.role = 'professional'
      AND p.company::text = p_company::text
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_professional_of_company(uuid) TO authenticated;

-- Update insert_event_json to use helper
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
    RETURNING id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_event_json(jsonb) TO authenticated;

-- Update update_event_json to use helper for company-member check
CREATE OR REPLACE FUNCTION public.update_event_json(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER AS $$
DECLARE
  p_id uuid := (p_payload->>'id')::uuid;
  p_changes jsonb := COALESCE(p_payload->'changes', '{}'::jsonb);
  v_company uuid;
  v_client uuid[] := NULL;
  v_professional uuid[] := NULL;
BEGIN
  SELECT client, professional, company INTO v_client, v_professional, v_company
  FROM public.events WHERE id = p_id LIMIT 1;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  -- Allow update if caller is member of company OR is listed as attendee
  IF NOT (
    public.is_professional_of_company(v_company)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user::text = auth.uid()::text AND (p.id = ANY (coalesce(v_client, ARRAY[]::uuid[])) OR p.id = ANY (coalesce(v_professional, ARRAY[]::uuid[]))))
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Safely extract client/professional arrays from JSON if present
  IF p_changes ? 'client' THEN
    SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_client
    FROM jsonb_array_elements_text(p_changes->'client') AS x;
  END IF;

  IF p_changes ? 'professional' THEN
    SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_professional
    FROM jsonb_array_elements_text(p_changes->'professional') AS x;
  END IF;

  UPDATE public.events
  SET
    type = COALESCE(p_changes->>'type', type),
    duration = COALESCE(NULLIF(p_changes->>'duration','')::int, duration),
    cost = COALESCE(NULLIF(p_changes->>'cost','')::numeric, cost),
    paid = COALESCE((p_changes->>'paid')::boolean, paid),
    notes = COALESCE(p_changes->>'notes', notes),
    datetime = COALESCE(NULLIF(p_changes->>'datetime','')::timestamptz, datetime),
    client = COALESCE(v_client, client),
    professional = COALESCE(v_professional, professional)
  WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_event_json(jsonb) TO authenticated;

-- Update delete_event_json to use helper
CREATE OR REPLACE FUNCTION public.delete_event_json(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER AS $$
DECLARE
  p_id uuid := (p_payload->>'id')::uuid;
  v_company uuid;
BEGIN
  SELECT company INTO v_company FROM public.events WHERE id = p_id LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  IF NOT public.is_professional_of_company(v_company) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  DELETE FROM public.events WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_event_json(jsonb) TO authenticated;

COMMIT;
