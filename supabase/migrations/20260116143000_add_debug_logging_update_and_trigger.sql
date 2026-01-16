-- Migration: add debug logging to update_event_json and adjust_class_credits_on_events_change
-- This migration adds temporary audit entries to capture raw client fields and errors when update_event_json runs

-- Replace update_event_json with additional logging
CREATE OR REPLACE FUNCTION public.update_event_json(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id uuid := NULLIF(p_payload->>'id','')::uuid;
  v_changes jsonb := COALESCE(p_payload->'changes', '{}'::jsonb);
  v_type text := v_changes->>'type';
  v_duration int := NULLIF(v_changes->>'duration','')::int;
  v_cost numeric := NULLIF(v_changes->>'cost','')::numeric;
  v_paid boolean := NULLIF(v_changes->>'paid','')::boolean;
  v_notes text := v_changes->>'notes';
  v_datetime text := v_changes->>'datetime';
  v_client uuid[] := NULL;
  v_professional uuid[] := NULL;
  v_event_company uuid := NULL;
  v_event_type text := NULL;
  v_event_client uuid[] := ARRAY[]::uuid[];
  v_new_clients uuid[] := ARRAY[]::uuid[];
  v_my_profile_id uuid := NULL;
  v_my_user_id uuid := NULL;
  v_auth_uid_text text := NULL;
  v_added uuid[] := ARRAY[]::uuid[];
  v_removed uuid[] := ARRAY[]::uuid[];
  v_event_client_raw text := NULL;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'id is required';
  END IF;

  -- Log incoming payload for debug (temporary)
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-start', FORMAT('id=%s changes=%s', v_id, v_changes::text));

  -- Normalize `client` payload: accept array or scalar uuid string; reject/raise for other scalar types
  IF v_changes ? 'client' THEN
    CASE jsonb_typeof(v_changes->'client')
      WHEN 'array' THEN
        BEGIN
          SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_client
          FROM jsonb_array_elements_text(v_changes->'client') AS x;
        EXCEPTION WHEN invalid_text_representation THEN
          INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-client-parse-error', 'invalid uuid in client array');
          RAISE EXCEPTION 'invalid uuid value in client array';
        END;
      WHEN 'string' THEN
        BEGIN
          v_client := ARRAY[ NULLIF(v_changes->>'client','')::uuid ];
        EXCEPTION WHEN invalid_text_representation THEN
          INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-client-parse-error', 'invalid uuid in client scalar');
          RAISE EXCEPTION 'invalid uuid value in client';
        END;
      WHEN 'null' THEN
        v_client := ARRAY[]::uuid[];
      ELSE
        INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-client-type-error', 'client must be array or string');
        RAISE EXCEPTION 'client must be an array of uuid or a uuid string';
    END CASE;
  END IF;

  -- Normalize `professional` payload
  IF v_changes ? 'professional' THEN
    CASE jsonb_typeof(v_changes->'professional')
      WHEN 'array' THEN
        BEGIN
          SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_professional
          FROM jsonb_array_elements_text(v_changes->'professional') AS x;
        EXCEPTION WHEN invalid_text_representation THEN
          INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-prof-parse-error', 'invalid uuid in professional array');
          RAISE EXCEPTION 'invalid uuid value in professional array';
        END;
      WHEN 'string' THEN
        BEGIN
          v_professional := ARRAY[ NULLIF(v_changes->>'professional','')::uuid ];
        EXCEPTION WHEN invalid_text_representation THEN
          INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-prof-parse-error', 'invalid uuid in professional scalar');
          RAISE EXCEPTION 'invalid uuid value in professional';
        END;
      WHEN 'null' THEN
        v_professional := ARRAY[]::uuid[];
      ELSE
        INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-prof-type-error', 'professional must be array or string');
        RAISE EXCEPTION 'professional must be an array of uuid or a uuid string';
    END CASE;
  END IF;

  -- Load event details (company, type and current client list)
  SELECT company, type, client::text INTO v_event_company, v_event_type, v_event_client_raw FROM public.events WHERE id = v_id;
  IF v_event_company IS NULL THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-event-notfound', FORMAT('id=%s', v_id));
    RAISE EXCEPTION 'event not found';
  END IF;

  -- Log DB stored client raw type/value
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-event-stored-client', FORMAT('id=%s stored_client_type=%s stored_client_raw=%s', v_id, pg_typeof((SELECT client FROM public.events WHERE id = v_id))::text, v_event_client_raw));

  -- Normalize whatever was stored in events.client into a uuid[] safely
  v_event_client := public.as_uuid_array(v_event_client_raw);

  -- Continue original logic (permission checks and adjustments)
  v_auth_uid_text := auth.uid();
  IF v_auth_uid_text IS NOT NULL AND v_auth_uid_text <> '' THEN
    v_my_user_id := v_auth_uid_text::uuid;
  ELSE
    v_my_user_id := NULL;
  END IF;

  IF v_my_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = v_my_user_id
      AND p.company = v_event_company
      AND (p.role = 'professional' OR p.role = 'admin')
  ) THEN
    -- allowed
  ELSE
    IF NOT (v_changes ? 'client' AND (v_changes - 'client') = '{}'::jsonb) THEN
      INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-permission-denied', FORMAT('id=%s changes=%s', v_id, v_changes::text));
      RAISE EXCEPTION 'permission denied';
    END IF;

    SELECT id INTO v_my_profile_id FROM public.profiles p WHERE p.user = v_my_user_id AND p.company = v_event_company LIMIT 1;
    v_new_clients := COALESCE(v_client, ARRAY[]::uuid[]);

    SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO v_added
    FROM unnest(v_new_clients) AS x
    WHERE NOT x = ANY(v_event_client);

    SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO v_removed
    FROM unnest(v_event_client) AS x
    WHERE NOT x = ANY(v_new_clients);

    -- Debugging: log inputs
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-debug', FORMAT('id=%s v_event_client=%s v_new_clients=%s v_added=%s v_removed=%s', v_id, v_event_client::text, v_new_clients::text, v_added::text, v_removed::text));

    IF v_event_type <> 'class' THEN
      INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-not-class', FORMAT('id=%s type=%s', v_id, v_event_type));
      RAISE EXCEPTION 'permission denied';
    END IF;

    IF EXISTS (
      SELECT 1 FROM unnest(coalesce(v_added, ARRAY[]::uuid[]) || coalesce(v_removed, ARRAY[]::uuid[])) AS u(x)
      WHERE NOT (
        (v_my_user_id IS NOT NULL AND x = v_my_user_id)
        OR (v_my_profile_id IS NOT NULL AND x = v_my_profile_id)
      )
    ) THEN
      INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-changed-id-not-owned', FORMAT('id=%s added=%s removed=%s', v_id, v_added::text, v_removed::text));
      RAISE EXCEPTION 'permission denied';
    END IF;
  END IF;

  -- Perform the update
  UPDATE public.events
  SET
    type = CASE WHEN v_changes ? 'type' THEN v_type ELSE type END,
    duration = CASE WHEN v_changes ? 'duration' THEN v_duration ELSE duration END,
    cost = CASE WHEN v_changes ? 'cost' THEN v_cost ELSE cost END,
    paid = CASE WHEN v_changes ? 'paid' THEN v_paid ELSE paid END,
    notes = CASE WHEN v_changes ? 'notes' THEN v_notes ELSE notes END,
    datetime = CASE WHEN v_changes ? 'datetime' AND NULLIF(v_datetime,'') IS NOT NULL THEN v_datetime::timestamptz ELSE datetime END,
    client = CASE WHEN v_changes ? 'client' THEN COALESCE(v_client, ARRAY[]::uuid[]) ELSE client END,
    professional = CASE WHEN v_changes ? 'professional' THEN COALESCE(v_professional, ARRAY[]::uuid[]) ELSE professional END
  WHERE id = v_id;

  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-update-finished', FORMAT('id=%s', v_id));
END;
$function$;

-- Replace trigger function with logging of raw values (temporary)
CREATE OR REPLACE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  op_text text := TG_OP;
  raw_client text := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-trg-insert', FORMAT('type=%s client_raw=%s', COALESCE(NEW.type,''), raw_client));
  ELSIF TG_OP = 'DELETE' THEN
    raw_client := COALESCE(OLD.client::text, '<null>');
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-trg-delete', FORMAT('type=%s client_raw=%s', COALESCE(OLD.type,''), raw_client));
  ELSIF TG_OP = 'UPDATE' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('dbg-trg-update', FORMAT('old_type=%s new_type=%s client_raw=%s', COALESCE(OLD.type,''), COALESCE(NEW.type,''), raw_client));
  END IF;

  -- Continue with original logic (use existing robust code by calling current implementation)
  -- For simplicity, call the earlier implementation by executing the logic inline (kept minimal here)
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits,0) - 1
      WHERE id = ANY(as_uuid_array(NEW.client))
        AND role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits,0) + 1
      WHERE id = ANY(as_uuid_array(OLD.client))
        AND role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.type, '') = 'class' OR COALESCE(OLD.type, '') = 'class' THEN
      -- Added
      WITH new_clients AS (
        SELECT unnest(as_uuid_array(NEW.client)) AS id
      ),
      old_clients AS (
        SELECT unnest(as_uuid_array(OLD.client)) AS id
      ),
      added AS (
        SELECT id FROM new_clients EXCEPT SELECT id FROM old_clients
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits,0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = p.id
      )
      WHERE p.id IN (SELECT id FROM added)
        AND p.role = 'client';

      -- Removed
      WITH new_clients AS (
        SELECT unnest(as_uuid_array(NEW.client)) AS id
      ),
      old_clients AS (
        SELECT unnest(as_uuid_array(OLD.client)) AS id
      ),
      removed AS (
        SELECT id FROM old_clients EXCEPT SELECT id FROM new_clients
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits,0) + (
        SELECT COUNT(*) FROM removed r WHERE r.id = p.id
      )
      WHERE p.id IN (SELECT id FROM removed)
        AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;
