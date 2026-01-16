-- Migration: report last 10 adjust_class_credits_audit entries via NOTICE (post insert tests)
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN SELECT id, op, note, client_uuids, created_at FROM public.adjust_class_credits_audit ORDER BY id DESC LIMIT 10 LOOP
    RAISE NOTICE 'AUDIT: id=% op=% note=% client_uuids=% created_at=%', rec.id, rec.op, rec.note, rec.client_uuids, rec.created_at;
  END LOOP;
END$$;