-- Migration: find events whose stored client value is not a proper uuid[]
DO $$
DECLARE cnt int := 0; rec record;
BEGIN
  SELECT count(*) INTO cnt FROM public.events WHERE client IS NOT NULL AND pg_typeof(client)::text <> 'uuid[]';
  INSERT INTO public.adjust_class_credits_audit(op, note, delta) VALUES('find-non-uuid-array', format('count=%s', cnt), cnt);

  FOR rec IN SELECT id, client, pg_typeof(client)::text AS ctype FROM public.events WHERE client IS NOT NULL AND pg_typeof(client)::text <> 'uuid[]' LIMIT 20 LOOP
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('find-sample', format('id=%s type=%s client=%s', rec.id, rec.ctype, rec.client));
  END LOOP;
END$$;