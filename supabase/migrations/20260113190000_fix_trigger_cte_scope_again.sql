-- Migration: replace trigger function to ensure CTEs are in scope for each UPDATE
-- This migration only replaces the trigger function and recreates the trigger binding.

-- Drop the trigger first (it depends on the function) so the function can be replaced safely
DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
DROP FUNCTION IF EXISTS public.adjust_class_credits_on_events_change();

CREATE OR REPLACE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- INSERT
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      WITH client_ids AS (
        SELECT unnest( as_uuid_array(NEW.client) ) AS id
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE (p.id IN (SELECT id FROM client_ids) OR p.user IN (SELECT id FROM client_ids))
        AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      WITH client_ids AS (
        SELECT unnest( as_uuid_array(OLD.client) ) AS id
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE (p.id IN (SELECT id FROM client_ids) OR p.user IN (SELECT id FROM client_ids))
        AND p.role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.type, '') = 'class' OR COALESCE(OLD.type, '') = 'class' THEN
      -- Added
      WITH new_clients AS (
        SELECT unnest( as_uuid_array(NEW.client) ) AS id
      ),
      old_clients AS (
        SELECT unnest( as_uuid_array(OLD.client) ) AS id
      ),
      added AS (
        SELECT id FROM new_clients EXCEPT SELECT id FROM old_clients
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = p.id OR a.id = p.user
      )
      WHERE (p.id IN (SELECT id FROM added) OR p.user IN (SELECT id FROM added))
        AND p.role = 'client';

      -- Removed
      WITH new_clients AS (
        SELECT unnest( as_uuid_array(NEW.client) ) AS id
      ),
      old_clients AS (
        SELECT unnest( as_uuid_array(OLD.client) ) AS id
      ),
      removed AS (
        SELECT id FROM old_clients EXCEPT SELECT id FROM new_clients
      )
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + (
        SELECT COUNT(*) FROM removed r WHERE r.id = p.id OR r.id = p.user
      )
      WHERE (p.id IN (SELECT id FROM removed) OR p.user IN (SELECT id FROM removed))
        AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Recreate trigger binding
DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();
