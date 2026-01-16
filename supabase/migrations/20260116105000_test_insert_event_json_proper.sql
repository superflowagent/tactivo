-- Migration: test insert_event_json using jsonb_build_object to avoid string concatenation issues
DO $$
DECLARE
  r uuid;
  company_id text := (SELECT id::text FROM public.companies LIMIT 1);
BEGIN
  BEGIN
    SELECT id INTO r FROM public.insert_event_json(jsonb_build_object('type','class','datetime','2026-01-16T12:00:00Z','client', jsonb_build_array('79bc93c5-1c4c-4513-a404-e91303a7f64f'),'company', company_id));
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-proper-array','ok');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-proper-array-error', SQLERRM);
  END;

  BEGIN
    SELECT id INTO r FROM public.insert_event_json(jsonb_build_object('type','class','datetime','2026-01-16T13:00:00Z','client','79bc93c5-1c4c-4513-a404-e91303a7f64f','company', company_id));
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-proper-string','ok');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.adjust_class_credits_audit(op, note) VALUES('test-insert-proper-string-error', SQLERRM);
  END;
END$$;