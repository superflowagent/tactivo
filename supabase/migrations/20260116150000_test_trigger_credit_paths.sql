-- Migration: test trigger behavior across insertion paths
DO $$
DECLARE
  p_id uuid := 'aaaaaaaa-0000-0000-0000-0000000000a1';
  company_id uuid := (SELECT id FROM public.companies LIMIT 1);
  before_credits int;
  after_credits int;
  e_id uuid;
  v_def text;
  rpc_payload jsonb;
BEGIN
  -- ensure profile exists and set class_credits to 3
  INSERT INTO public.profiles (id, "user", company, role, name, class_credits)
  VALUES (p_id, NULL, company_id, 'client', 'TriggerTest', 3)
  ON CONFLICT (id) DO UPDATE SET class_credits = EXCLUDED.class_credits;

  SELECT class_credits INTO before_credits FROM public.profiles WHERE id = p_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-setup', FORMAT('profile=%s before=%s', p_id, before_credits));

  -- Capture current function definition
  BEGIN
    SELECT pg_get_functiondef('public.adjust_class_credits_on_events_change'::regproc) INTO v_def;
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('func-def', left(v_def, 4000));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('func-def-error', SQLERRM);
  END;

  -- 1) Direct INSERT of class -> should deduct 1
  DELETE FROM public.events WHERE notes = 'test-trigger-check-direct' OR notes = 'test-trigger-check-rpc' OR notes = 'test-trigger-check-appointment';

  UPDATE public.profiles SET class_credits = 3 WHERE id = p_id;
  SELECT class_credits INTO before_credits FROM public.profiles WHERE id = p_id;

  INSERT INTO public.events (type, datetime, client, company, notes) VALUES ('class', now(), ARRAY[p_id]::uuid[], company_id, 'test-trigger-check-direct') RETURNING id INTO e_id;

  SELECT class_credits INTO after_credits FROM public.profiles WHERE id = p_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('direct-insert', FORMAT('before=%s after=%s event=%s', before_credits, after_credits, e_id));

  -- Cleanup that event
  DELETE FROM public.events WHERE id = e_id;

  -- 2) RPC insert_event_json -> should deduct 1
  UPDATE public.profiles SET class_credits = 3 WHERE id = p_id;
  SELECT class_credits INTO before_credits FROM public.profiles WHERE id = p_id;

  rpc_payload := jsonb_build_object('type', 'class', 'datetime', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'), 'client', jsonb_build_array(p_id::text), 'professional', jsonb_build_array(NULL), 'company', company_id::text, 'notes', 'test-trigger-check-rpc');

  BEGIN
    PERFORM public.insert_event_json(rpc_payload);
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('rpc-insert-call', 'ok');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('rpc-insert-error', SQLERRM);
  END;

  SELECT class_credits INTO after_credits FROM public.profiles WHERE id = p_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('rpc-insert-result', FORMAT('before=%s after=%s', before_credits, after_credits));

  -- Remove rpc inserted events
  DELETE FROM public.events WHERE notes = 'test-trigger-check-rpc';

  -- 3) Create appointment then update to class via update_event_json -> should deduct 1 when updating to class
  UPDATE public.profiles SET class_credits = 3 WHERE id = p_id;
  SELECT class_credits INTO before_credits FROM public.profiles WHERE id = p_id;

  INSERT INTO public.events (type, datetime, client, company, notes) VALUES ('appointment', now(), ARRAY[p_id]::uuid[], company_id, 'test-trigger-check-appointment') RETURNING id INTO e_id;

  BEGIN
    PERFORM public.update_event_json(jsonb_build_object('id', e_id::text, 'changes', jsonb_build_object('type','class')));
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('rpc-update-call', 'ok');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('rpc-update-error', SQLERRM);
  END;

  SELECT class_credits INTO after_credits FROM public.profiles WHERE id = p_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('rpc-update-result', FORMAT('before=%s after=%s event=%s', before_credits, after_credits, e_id));

  -- Cleanup events
  DELETE FROM public.events WHERE notes LIKE 'test-trigger-check-%';
END$$;