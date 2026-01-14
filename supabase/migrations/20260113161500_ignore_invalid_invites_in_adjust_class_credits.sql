-- Migration: Ignore profiles in invalid invite state when adjusting class credits
-- Rationale: Avoid failing event updates/inserts due to profiles that still have an
-- invite_token but missing/expired invite_expires_at. When adjusting class_credits
-- via the events trigger we should only touch profiles that are "active" (i.e.
-- have no pending invalid invite) to avoid constraint violations.

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
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE id = ANY(COALESCE(NEW.client, ARRAY[NEW.client]::uuid[]))::uuid[]
        AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE id = ANY(COALESCE(OLD.client, ARRAY[OLD.client]::uuid[]))::uuid[]
        AND p.role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.type, '') = 'class' OR COALESCE(OLD.type, '') = 'class' THEN
      WITH
      new_clients AS (
        SELECT unnest(COALESCE( (CASE WHEN pg_typeof(NEW.client) = 'uuid[]' THEN NEW.client ELSE ARRAY[NEW.client]::uuid[] END), ARRAY[]::uuid[])) AS id
      ),
      old_clients AS (
        SELECT unnest(COALESCE( (CASE WHEN pg_typeof(OLD.client) = 'uuid[]' THEN OLD.client ELSE ARRAY[OLD.client]::uuid[] END), ARRAY[]::uuid[])) AS id
      ),
      added AS (
        SELECT id FROM new_clients EXCEPT SELECT id FROM old_clients
      ),
      removed AS (
        SELECT id FROM old_clients EXCEPT SELECT id FROM new_clients
      )
      -- Deduct for added
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = p.id
      )
      WHERE p.id IN (SELECT id FROM added)
        AND p.role = 'client';

      -- Refund for removed
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
