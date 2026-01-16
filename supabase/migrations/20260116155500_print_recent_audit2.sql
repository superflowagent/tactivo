DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT created_at, op, LEFT(note, 400) AS note FROM public.adjust_class_credits_audit ORDER BY created_at DESC LIMIT 80 LOOP
    RAISE NOTICE 'AUDIT % | % | %', rec.created_at, rec.op, rec.note;
  END LOOP;
END$$;