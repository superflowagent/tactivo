-- Migration: test insert_event_json with different client payload shapes and log errors
DO $$
DECLARE
  r uuid;
BEGIN
  -- client as string
  BEGIN
    SELECT id INTO r FROM public.insert_event_json('{"type":"class","datetime":"2026-01-16T10:00:00Z","client":"79bc93c5-1c4c-4513-a404-e91303a7f64f","company":"' || (SELECT id::text FROM public.companies LIMIT 1) || '"}'::jsonb);
    INSERT INTO public.adjust_class_credits_audit(op, note, client_uuids) VALUES('test-insert-string','ok-insert-string', r::uuid[]);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-string-error', SQLERRM);
  END;

  -- client as array
  BEGIN
    SELECT id INTO r FROM public.insert_event_json('{"type":"class","datetime":"2026-01-16T11:00:00Z","client":["79bc93c5-1c4c-4513-a404-e91303a7f64f"],"company":"' || (SELECT id::text FROM public.companies LIMIT 1) || '"}'::jsonb);
    INSERT INTO public.adjust_class_credits_audit(op, note, client_uuids) VALUES('test-insert-array','ok-insert-array', r::uuid[]);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-array-error', SQLERRM);
  END;
END$$;