-- Migration: insert event with NULL client then update client to a UUID array to see when error occurs
DO $$
DECLARE e_id uuid;
BEGIN
  INSERT INTO public.events (type, datetime, client, company)
  VALUES ('class', now(), NULL, (SELECT id FROM public.companies LIMIT 1))
  RETURNING id INTO e_id;

  RAISE NOTICE 'Inserted event id=% with NULL client', e_id;

  BEGIN
    UPDATE public.events SET client = ARRAY['00000000-0000-0000-0000-000000000061']::uuid[] WHERE id = e_id;
    RAISE NOTICE 'Updated event client to array for id=%', e_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Update client error: %', SQLERRM;
  END;

END$$;