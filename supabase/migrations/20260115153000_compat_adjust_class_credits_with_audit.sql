-- Migration: compatibility/fix for adjust_class_credits trigger
-- 1) Accept profile.user as fallback when matching event.client (temporary compatibility shim)
-- 2) Add audit table so we can verify the trigger runs and what it changes

DROP TABLE IF EXISTS public.adjust_class_credits_audit;
CREATE TABLE public.adjust_class_credits_audit (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  op text NOT NULL,
  old_type text,
  new_type text,
  client_uuids uuid[] NULL,
  affected_profiles uuid[] NULL,
  delta int NULL,
  note text NULL
);

DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
DROP FUNCTION IF EXISTS public.adjust_class_credits_on_events_change();

CREATE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  client_ids uuid[] := ARRAY[]::uuid[];
  affected uuid[] := ARRAY[]::uuid[];
BEGIN
  -- INSERT
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO client_ids FROM (SELECT unnest(as_uuid_array(NEW.client)) AS x) s;
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits,0) - 1
      WHERE (p.id = ANY(client_ids) OR p.user = ANY(client_ids))
        AND p.role = 'client'
      RETURNING p.id INTO affected;
      INSERT INTO public.adjust_class_credits_audit(op, new_type, client_uuids, affected_profiles, delta, note)
      VALUES('insert-deduct', COALESCE(NEW.type,''), client_ids, affected, -1, 'deduct on insert (compat)');
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO client_ids FROM (SELECT unnest(as_uuid_array(OLD.client)) AS x) s;
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits,0) + 1
      WHERE (p.id = ANY(client_ids) OR p.user = ANY(client_ids))
        AND p.role = 'client'
      RETURNING p.id INTO affected;
      INSERT INTO public.adjust_class_credits_audit(op, old_type, client_uuids, affected_profiles, delta, note)
      VALUES('delete-refund', COALESCE(OLD.type,''), client_ids, affected, 1, 'refund on delete (compat)');
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Case A: type changed FROM 'class' TO non-'class' -> refund ALL OLD clients
    IF COALESCE(OLD.type, '') = 'class' AND COALESCE(NEW.type, '') <> 'class' THEN
      IF OLD.client IS NOT NULL THEN
        SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO client_ids FROM (SELECT unnest(as_uuid_array(OLD.client)) AS x) s;
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits,0) + 1
        WHERE (p.id = ANY(client_ids) OR p.user = ANY(client_ids))
          AND p.role = 'client'
        RETURNING p.id INTO affected;
        INSERT INTO public.adjust_class_credits_audit(op, old_type, new_type, client_uuids, affected_profiles, delta, note)
        VALUES('type-change-refund', COALESCE(OLD.type,''), COALESCE(NEW.type,''), client_ids, affected, 1, 'refund on type change (class->non-class) (compat)');
      END IF;
    -- Case B: type changed FROM non-'class' TO 'class' -> deduct ALL NEW clients
    ELSIF COALESCE(OLD.type, '') <> 'class' AND COALESCE(NEW.type, '') = 'class' THEN
      IF NEW.client IS NOT NULL THEN
        SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO client_ids FROM (SELECT unnest(as_uuid_array(NEW.client)) AS x) s;
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits,0) - 1
        WHERE (p.id = ANY(client_ids) OR p.user = ANY(client_ids))
          AND p.role = 'client'
        RETURNING p.id INTO affected;
        INSERT INTO public.adjust_class_credits_audit(op, old_type, new_type, client_uuids, affected_profiles, delta, note)
        VALUES('type-change-deduct', COALESCE(OLD.type,''), COALESCE(NEW.type,''), client_ids, affected, -1, 'deduct on type change (non-class->class) (compat)');
      END IF;
    -- Case C: both are 'class' -> handle added and removed clients
    ELSIF COALESCE(OLD.type, '') = 'class' AND COALESCE(NEW.type, '') = 'class' THEN
      -- Added
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
      SET class_credits = COALESCE(class_credits,0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = p.id OR a.id = p.user
      )
      WHERE (p.id IN (SELECT id FROM added) OR p.user IN (SELECT id FROM added))
        AND p.role = 'client'
      RETURNING p.id INTO affected;
      IF affected IS NOT NULL THEN
        INSERT INTO public.adjust_class_credits_audit(op, new_type, client_uuids, affected_profiles, delta, note)
        VALUES('added-deduct', COALESCE(NEW.type,''), (SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) FROM added), affected, -1, 'deduct for added clients (compat)');
      END IF;

      -- Removed
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
      SET class_credits = COALESCE(class_credits,0) + (
        SELECT COUNT(*) FROM removed r WHERE r.id = p.id OR r.id = p.user
      )
      WHERE (p.id IN (SELECT id FROM removed) OR p.user IN (SELECT id FROM removed))
        AND p.role = 'client'
      RETURNING p.id INTO affected;
      IF affected IS NOT NULL THEN
        INSERT INTO public.adjust_class_credits_audit(op, new_type, client_uuids, affected_profiles, delta, note)
        VALUES('removed-refund', COALESCE(NEW.type,''), (SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) FROM removed), affected, 1, 'refund for removed clients (compat)');
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();
