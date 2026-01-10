-- Migration: fix parentheses so we cast array before ANY() to avoid boolean->uuid[] cast error
DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
DROP FUNCTION IF EXISTS public.adjust_class_credits_on_events_change();

CREATE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE id = ANY( (COALESCE(NEW.client, ARRAY[NEW.client]::uuid[]))::uuid[] )
        AND role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE id = ANY( (COALESCE(OLD.client, ARRAY[OLD.client]::uuid[]))::uuid[] )
        AND role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  -- Handle UPDATE
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
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = public.profiles.id
      )
      WHERE id IN (SELECT id FROM added) AND role = 'client';

      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) + (
        SELECT COUNT(*) FROM removed r WHERE r.id = public.profiles.id
      )
      WHERE id IN (SELECT id FROM removed) AND role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();
