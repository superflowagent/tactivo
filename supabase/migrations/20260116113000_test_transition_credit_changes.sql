-- Migration: test credits when toggling appointment -> class and class -> appointment
DO $$
DECLARE e_id uuid;
BEGIN
  -- Setup test client A
  INSERT INTO public.profiles (id, "user", company, role, name, class_credits)
  VALUES ('00000000-0000-0000-0000-000000000011', NULL, (SELECT id FROM public.companies LIMIT 1), 'client', 'TA1', 2)
  ON CONFLICT (id) DO UPDATE SET class_credits = 2;

  -- Create appointment with client A
  INSERT INTO public.events (type, datetime, client, company)
  VALUES ('appointment', now(), ARRAY['00000000-0000-0000-0000-000000000011']::uuid[], (SELECT id FROM public.companies LIMIT 1))
  RETURNING id INTO e_id;

  -- Toggle to class -> should deduct 1
  UPDATE public.events SET type = 'class' WHERE id = e_id;

  INSERT INTO public.adjust_class_credits_audit(op, note, client_uuids, affected_profiles, delta)
  VALUES('test-appointment->class','after toggle', (SELECT client FROM public.events WHERE id = e_id), ARRAY[(SELECT class_credits FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000011')], (SELECT class_credits FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000011'));

  -- Setup test client B
  INSERT INTO public.profiles (id, "user", company, role, name, class_credits)
  VALUES ('00000000-0000-0000-0000-000000000022', NULL, (SELECT id FROM public.companies LIMIT 1), 'client', 'TB2', 5)
  ON CONFLICT (id) DO UPDATE SET class_credits = 5;

  -- Create class with client B
  INSERT INTO public.events (type, datetime, client, company)
  VALUES ('class', now(), ARRAY['00000000-0000-0000-0000-000000000022']::uuid[], (SELECT id FROM public.companies LIMIT 1))
  RETURNING id INTO e_id;

  -- Toggle to appointment -> should refund 1
  UPDATE public.events SET type = 'appointment' WHERE id = e_id;

  INSERT INTO public.adjust_class_credits_audit(op, note, client_uuids, affected_profiles, delta)
  VALUES('test-class->appointment','after toggle', (SELECT client FROM public.events WHERE id = e_id), ARRAY[(SELECT class_credits FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000022')], (SELECT class_credits FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000022'));
END$$;