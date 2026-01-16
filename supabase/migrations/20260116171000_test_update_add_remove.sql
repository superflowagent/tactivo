DO $$
DECLARE
  p_id uuid;
  company_id uuid := (SELECT id FROM public.companies LIMIT 1);
  e_id uuid;
  before int;
  after int;
BEGIN
  -- Pick an existing client profile
  SELECT id INTO p_id FROM public.profiles WHERE role = 'client' LIMIT 1;
  IF p_id IS NULL THEN
    RAISE NOTICE 'no client profile found, skipping';
    RETURN;
  END IF;

  -- Ensure profile has known credits
  UPDATE public.profiles SET class_credits = 10 WHERE id = p_id;
  SELECT class_credits INTO before FROM public.profiles WHERE id = p_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-setup-update', FORMAT('profile=%s before=%s', p_id, before));

  -- Create an appointment with that client
  INSERT INTO public.events (type, datetime, client, company, notes) VALUES ('appointment', now(), ARRAY[p_id]::uuid[], company_id, 'test-update-add-remove') RETURNING id INTO e_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-appointment', FORMAT('event=%s', e_id));

  -- Update the event to type 'class' (should deduct 1)
  UPDATE public.events SET type = 'class' WHERE id = e_id;
  SELECT class_credits INTO after FROM public.profiles WHERE id = p_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-update-to-class', FORMAT('before=%s after=%s event=%s', before, after, e_id));

  -- Now update to remove the client (refund)
  UPDATE public.events SET client = ARRAY[]::uuid[] WHERE id = e_id;
  SELECT class_credits INTO before FROM public.profiles WHERE id = p_id;
  UPDATE public.events SET type = 'appointment' WHERE id = e_id; -- change type away from class (trigger should refund on removal)
  SELECT class_credits INTO after FROM public.profiles WHERE id = p_id;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-remove-client-refund', FORMAT('before2=%s after2=%s event=%s', before, after, e_id));

  -- Cleanup
  DELETE FROM public.events WHERE id = e_id;
END$$;