DO $$
DECLARE
  p record;
  company_id uuid := (SELECT id FROM public.companies LIMIT 1);
  e1 uuid;
  user_client uuid[] := ARRAY[]::uuid[];
  mapped uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT id, "user" INTO p FROM public.profiles WHERE "user" IS NOT NULL LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-map-skip','no profile with user found');
    RETURN;
  END IF;

  user_client := ARRAY[p.user::uuid];
  SELECT coalesce(array_agg(coalesce(pr.id, x::uuid)), ARRAY[]::uuid[]) INTO mapped
  FROM unnest(user_client) AS x
  LEFT JOIN public.profiles pr ON pr.user = x::uuid;

  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-mapping-debug', FORMAT('profile=%s user=%s mapped=%s', p.id, p.user, mapped::text));

  -- Insert event using mapped array - should deduct (if mapped has id)
  INSERT INTO public.events (type, datetime, client, company, notes)
    VALUES ('class', now(), mapped, company_id, 'test-mapping-applied-insert') RETURNING id INTO e1;
  INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-mapping-insert', FORMAT('event=%s mapped=%s', e1, mapped::text));
END$$;