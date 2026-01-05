-- Migration: Make update_event_json and delete_event_json VOLATILE so they can perform UPDATE/DELETE

BEGIN;

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
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user::text = auth.uid()::text AND p.company::text = v_company::text)
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

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user::text = auth.uid()::text AND p.role = 'professional' AND p.company::text = v_company::text
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  DELETE FROM public.events WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_event_json(jsonb) TO authenticated;

COMMIT;
