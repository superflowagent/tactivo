-- Migration: fix scope issue in adjust_class_credits_on_events_change (don't reference CTEs outside WITH)
CREATE OR REPLACE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  op_text text := TG_OP;
  raw_client text := NULL;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_rowcount int := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');
    -- collect the profile ids that would be affected
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE p.id = ANY(as_uuid_array(NEW.client)) AND p.role = 'client';

    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE (id = ANY(v_ids))
        AND role = 'client';
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      INSERT INTO public.adjust_class_credits_audit(op, note)
      VALUES('insert-deduct', FORMAT('raw=%s ids=%s count=%s', raw_client, array_to_string(v_ids, ','), v_rowcount));
    ELSE
      INSERT INTO public.adjust_class_credits_audit(op, note)
      VALUES('insert-skip', FORMAT('raw=%s', raw_client));
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    raw_client := COALESCE(OLD.client::text, '<null>');
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE p.id = ANY(as_uuid_array(OLD.client)) AND p.role = 'client';

    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE (id = ANY(v_ids))
        AND role = 'client';
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      INSERT INTO public.adjust_class_credits_audit(op, note)
      VALUES('delete-refund', FORMAT('raw=%s ids=%s count=%s', raw_client, array_to_string(v_ids, ','), v_rowcount));
    ELSE
      INSERT INTO public.adjust_class_credits_audit(op, note)
      VALUES('delete-skip', FORMAT('raw=%s', raw_client));
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');

    IF COALESCE(NEW.type, '') = 'class' OR COALESCE(OLD.type, '') = 'class' THEN
      -- Added
      WITH new_clients AS (
        SELECT unnest(as_uuid_array(NEW.client)) AS id
      ),
      old_clients AS (
        SELECT unnest(as_uuid_array(OLD.client)) AS id
      ),
      added AS (
        SELECT id FROM new_clients EXCEPT SELECT id FROM old_clients
      )
      SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM added;

      IF array_length(v_ids,1) IS NOT NULL THEN
        -- Deduct 1 credit for each distinct added profile (match by id or user)
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) - 1
        WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids))
          AND p.role = 'client';
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        INSERT INTO public.adjust_class_credits_audit(op, note)
        VALUES('update-add-deduct', FORMAT('raw=%s added=%s count=%s', raw_client, array_to_string(v_ids, ','), v_rowcount));
      ELSE
        INSERT INTO public.adjust_class_credits_audit(op, note)
        VALUES('update-add-none', FORMAT('raw=%s', raw_client));
      END IF;

      -- Removed
      WITH new_clients AS (
        SELECT unnest(as_uuid_array(NEW.client)) AS id
      ),
      old_clients AS (
        SELECT unnest(as_uuid_array(OLD.client)) AS id
      ),
      removed AS (
        SELECT id FROM old_clients EXCEPT SELECT id FROM new_clients
      )
      SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM removed;

      IF array_length(v_ids,1) IS NOT NULL THEN
        -- Refund 1 credit for each distinct removed profile (match by id or user)
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) + 1
        WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids))
          AND p.role = 'client';
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        INSERT INTO public.adjust_class_credits_audit(op, note)
        VALUES('update-remove-refund', FORMAT('raw=%s removed=%s count=%s', raw_client, array_to_string(v_ids, ','), v_rowcount));
      ELSE
        INSERT INTO public.adjust_class_credits_audit(op, note)
        VALUES('update-remove-none', FORMAT('raw=%s', raw_client));
      END IF;
    ELSE
      INSERT INTO public.adjust_class_credits_audit(op, note)
      VALUES('update-skip', FORMAT('old=%s new=%s', COALESCE(OLD.type,''), COALESCE(NEW.type,'')));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Recreate trigger binding to ensure new function is used
DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();