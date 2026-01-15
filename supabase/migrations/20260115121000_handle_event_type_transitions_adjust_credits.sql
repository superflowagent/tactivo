-- Migration: correctly adjust class_credits on event type transitions
-- Ensures refunds when type changes from 'class' -> non-class (even if client list unchanged)
-- and deductions when type changes from non-class -> 'class' (even if client list unchanged).

DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
DROP FUNCTION IF EXISTS public.adjust_class_credits_on_events_change();

CREATE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- INSERT
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      WITH client_ids AS (
        SELECT unnest(as_uuid_array(NEW.client)) AS id
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE p.id IN (SELECT id FROM client_ids)
        AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      WITH client_ids AS (
        SELECT unnest(as_uuid_array(OLD.client)) AS id
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE p.id IN (SELECT id FROM client_ids)
        AND p.role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Case A: type changed FROM 'class' TO non-'class' -> refund ALL OLD clients
    IF COALESCE(OLD.type, '') = 'class' AND COALESCE(NEW.type, '') <> 'class' THEN
      IF OLD.client IS NOT NULL THEN
        WITH client_ids AS (
          SELECT unnest(as_uuid_array(OLD.client)) AS id
        )
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) + 1
        WHERE p.id IN (SELECT id FROM client_ids)
          AND p.role = 'client';
      END IF;
    -- Case B: type changed FROM non-'class' TO 'class' -> deduct ALL NEW clients
    ELSIF COALESCE(OLD.type, '') <> 'class' AND COALESCE(NEW.type, '') = 'class' THEN
      IF NEW.client IS NOT NULL THEN
        WITH client_ids AS (
          SELECT unnest(as_uuid_array(NEW.client)) AS id
        )
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) - 1
        WHERE p.id IN (SELECT id FROM client_ids)
          AND p.role = 'client';
      END IF;
    -- Case C: both are 'class' -> handle added and removed clients as before
    ELSIF COALESCE(OLD.type, '') = 'class' AND COALESCE(NEW.type, '') = 'class' THEN
      WITH
      new_clients AS (
        SELECT unnest(as_uuid_array(NEW.client)) AS id
      ),
      old_clients AS (
        SELECT unnest(as_uuid_array(OLD.client)) AS id
      ),
      added AS (
        SELECT id FROM new_clients EXCEPT SELECT id FROM old_clients
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = p.id
      )
      WHERE p.id IN (SELECT id FROM added)
        AND p.role = 'client';

      WITH
      new_clients AS (
        SELECT unnest(as_uuid_array(NEW.client)) AS id
      ),
      old_clients AS (
        SELECT unnest(as_uuid_array(OLD.client)) AS id
      ),
      removed AS (
        SELECT id FROM old_clients EXCEPT SELECT id FROM new_clients
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + (
        SELECT COUNT(*) FROM removed r WHERE r.id = p.id
      )
      WHERE p.id IN (SELECT id FROM removed)
        AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();
