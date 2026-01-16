-- Migration: report results of force-normalize migration
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN SELECT id, op, note, delta, created_at FROM public.adjust_class_credits_audit ORDER BY id DESC LIMIT 10 LOOP
    RAISE NOTICE 'AUDIT: id=% op=% note=% delta=% created_at=%', rec.id, rec.op, rec.note, rec.delta, rec.created_at;
  END LOOP;
END$$;