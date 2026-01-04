-- Migration: Add SECURITY DEFINER RPCs for creating/updating/deleting events

BEGIN;

-- Insert event RPC: only professionals of the company can insert
CREATE OR REPLACE FUNCTION public.insert_event(
  p_title text,
  p_type text,
  p_duration int,
  p_cost numeric,
  p_paid boolean,
  p_notes text,
  p_datetime text,
  p_client uuid[],
  p_professional uuid[],
  p_company uuid
)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- Only allow professionals of the company (inline check: function is SECURITY DEFINER so this SELECT is allowed)
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.role = 'professional'
      AND p.company::text = p_company::text
  ) THEN 1 ELSE 0 END;
  INSERT INTO public.events (type, duration, cost, paid, notes, datetime, client, professional, company)
  VALUES (p_type, p_duration, p_cost, p_paid, p_notes, p_datetime::timestamptz, coalesce(p_client, ARRAY[]::uuid[]), coalesce(p_professional, ARRAY[]::uuid[]), p_company)
  RETURNING id;
$$;
GRANT EXECUTE ON FUNCTION public.insert_event(text,text,int,numeric,boolean,text,text,uuid[],uuid[],uuid) TO authenticated;

-- Update event RPC: allow members of company or attendees to update; professionals required for company-level changes
CREATE OR REPLACE FUNCTION public.update_event(
  p_id uuid,
  p_changes jsonb
)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_company uuid;
BEGIN
  SELECT company INTO v_company FROM public.events WHERE id = p_id LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  -- Only allow members of company or attendees (by profile id) to update
  IF NOT (public.is_member_of_company(v_company) OR (
      -- try to check if auth user is in client/professional arrays by comparing profile id to auth uid
      (SELECT id = ANY (coalesce(client, ARRAY[]::uuid[])) FROM public.events WHERE id = p_id)
  )) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Perform update using safe columns only
  UPDATE public.events
  SET
    type = COALESCE(p_changes->>'type', type),
    duration = COALESCE(NULLIF(p_changes->>'duration','')::int, duration),
    cost = COALESCE(NULLIF(p_changes->>'cost','')::numeric, cost),
    paid = COALESCE((p_changes->>'paid')::boolean, paid),
    notes = COALESCE(p_changes->>'notes', notes),
    datetime = COALESCE(NULLIF(p_changes->>'datetime','')::timestamptz, datetime),
    client = COALESCE((p_changes->'client')::uuid[], client),
    professional = COALESCE((p_changes->'professional')::uuid[], professional)
  WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_event(uuid,jsonb) TO authenticated;

-- Delete event RPC: only professionals of the company can delete
CREATE OR REPLACE FUNCTION public.delete_event(p_id uuid)
RETURNS void
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  DELETE FROM public.events e
  WHERE e.id = p_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user::text = auth.uid()::text
        AND p.role = 'professional'
        AND p.company::text = e.company::text
    );
$$;
GRANT EXECUTE ON FUNCTION public.delete_event(uuid) TO authenticated;

COMMIT;
