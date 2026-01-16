-- Migration: inspect an existing event's client value and type to debug malformed array errors

DO $$
DECLARE v_id uuid;
        v_client_text text;
        v_client_type text;
        v_type text;
BEGIN
  SELECT id, client, type INTO v_id, v_client_text, v_type
  FROM public.events
  WHERE client IS NOT NULL
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('inspect-no-event','no event with client found');
  ELSE
    SELECT pg_typeof(client)::text INTO v_client_type FROM public.events WHERE id = v_id;
    INSERT INTO public.adjust_class_credits_audit(op, note, old_type, new_type)
    VALUES('inspect-client-type', FORMAT('client=%s', v_client_text), v_type, v_client_type);
  END IF;
END$$;