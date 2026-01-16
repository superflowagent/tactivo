-- Migration: reproduce update_event_json for event id 57c059dd-b20a-42dc-a9c4-ee93fbb2f752
DO $$
DECLARE
  v_payload jsonb := '{"p_payload": {"id": "57c059dd-b20a-42dc-a9c4-ee93fbb2f752", "changes": {"type":"class","duration":90,"cost":0,"paid":false,"notes":"","datetime":"2026-01-17T11:00:00+01:00","client":["ec7d17a1-a129-404f-a9cd-0411ed5be04a"],"professional":["e528fd3d-2eb5-4d2d-8b94-6c67b8d9706e"],"company":"7659f9de-3ab0-4c19-8950-181d6b4d62a8"}} }'::jsonb;
  v_before_client text;
  v_before_type text;
  v_after_client text;
  v_after_type text;
BEGIN
  -- record current stored client + type for the event
  SELECT pg_typeof(client)::text, client::text INTO v_before_type, v_before_client FROM public.events WHERE id = '57c059dd-b20a-42dc-a9c4-ee93fbb2f752' LIMIT 1;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('repro-before','before: type=' || v_before_type || ' client=' || COALESCE(v_before_client,'<null>'));

  -- Try to call the RPC (update_event_json)
  BEGIN
    PERFORM public.update_event_json(v_payload->'p_payload');
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('repro-call','update_event_json succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('repro-error', SQLERRM);
  END;

  -- record resulting stored client + type
  SELECT pg_typeof(client)::text, client::text INTO v_after_type, v_after_client FROM public.events WHERE id = '57c059dd-b20a-42dc-a9c4-ee93fbb2f752' LIMIT 1;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('repro-after','after: type=' || v_after_type || ' client=' || COALESCE(v_after_client,'<null>'));
END$$;