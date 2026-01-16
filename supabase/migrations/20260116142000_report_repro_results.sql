-- Migration: report last 20 entries from audit after reproduction test
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN SELECT id, op, note, created_at FROM public.adjust_class_credits_audit ORDER BY id DESC LIMIT 20 LOOP
    RAISE NOTICE 'AUDIT: id=% op=% note=% created_at=%', rec.id, rec.op, rec.note, rec.created_at;
  END LOOP;
END$$;