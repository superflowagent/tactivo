DO $$
DECLARE
  p_with_user record;
  company_id uuid := (SELECT id FROM public.companies LIMIT 1);
  e1 uuid;
  e2 uuid;
BEGIN
  SELECT id, "user" INTO p_with_user FROM public.profiles WHERE "user" IS NOT NULL LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-client-user-skip','no profile with user found');
    RETURN;
  END IF;

  -- Insert event with client = profile.id (should deduct)
  INSERT INTO public.events (type, datetime, client, company, notes)
    VALUES ('class', now(), ARRAY[p_with_user.id]::uuid[], company_id, 'test-client-id-existing') RETURNING id INTO e1;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-client-id-existing', FORMAT('event=%s profile=%s user=%s', e1, p_with_user.id, p_with_user.user));

  -- Insert event with client = profile.user (should NOT deduct on INSERT under current logic)
  INSERT INTO public.events (type, datetime, client, company, notes)
    VALUES ('class', now(), ARRAY[p_with_user.user::uuid]::uuid[], company_id, 'test-client-user-existing') RETURNING id INTO e2;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-client-user-existing', FORMAT('event=%s profile=%s user=%s', e2, p_with_user.id, p_with_user.user));
END$$;