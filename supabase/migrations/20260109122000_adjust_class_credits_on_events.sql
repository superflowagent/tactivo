-- Migration: adjust class credits when clients are added/removed from events
-- Created by automated change

-- Safety: drop existing trigger/function if present
DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
DROP FUNCTION IF EXISTS public.adjust_class_credits_on_events_change();

-- Function to adjust class credits on events changes
CREATE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  added_id uuid;
  removed_id uuid;
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      -- if client is scalar uuid, normalize to array
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE id = ANY(COALESCE(NEW.client, ARRAY[NEW.client]::uuid[]))::uuid[]
        AND role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE id = ANY(COALESCE(OLD.client, ARRAY[OLD.client]::uuid[]))::uuid[]
        AND role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Only act if type is class in either old or new
    IF COALESCE(NEW.type, '') = 'class' OR COALESCE(OLD.type, '') = 'class' THEN
      -- normalize arrays (handles scalar or array stored as text)
      -- use COALESCE to ensure arrays are not null
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
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = public.profiles.id
      )
      WHERE id IN (SELECT id FROM added) AND role = 'client';

      -- Refund for removed
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

-- Create trigger
CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();

-- Verification helper (non-destructive): lists clients with counts of class events
-- Use for manual verification before/after running backfill

-- SELECT p.id, p.class_credits, COALESCE(cnt.count,0) as events_count
-- FROM public.profiles p
-- LEFT JOIN (
--   SELECT unnest(client) AS client_id, count(*) as count
--   FROM public.events
--   WHERE type = 'class'
--   GROUP BY unnest(client)
-- ) cnt ON p.id = cnt.client_id
-- WHERE cnt.count IS NOT NULL
-- ORDER BY cnt.count DESC;
