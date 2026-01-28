-- Migration: ensure adjust_class_credits_on_events_change looks up profiles by id OR user
-- This migration updates the trigger function to correctly deduct/refund class_credits

CREATE OR REPLACE FUNCTION "public"."adjust_class_credits_on_events_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  raw_client text := NULL;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE (p.id = ANY(as_uuid_array(NEW.client)) OR p."user" = ANY(as_uuid_array(NEW.client))) AND p.role = 'client';

    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE (p.id = ANY(v_ids) OR p."user" = ANY(v_ids)) AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    raw_client := COALESCE(OLD.client::text, '<null>');
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE (p.id = ANY(as_uuid_array(OLD.client)) OR p."user" = ANY(as_uuid_array(OLD.client))) AND p.role = 'client';

    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE (p.id = ANY(v_ids) OR p."user" = ANY(v_ids)) AND p.role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');

    -- Transition: non-class -> class (deduct for all NEW clients)
    IF COALESCE(OLD.type,'') <> 'class' AND COALESCE(NEW.type,'') = 'class' THEN
      SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
      FROM public.profiles p
      WHERE (p.id = ANY(as_uuid_array(NEW.client)) OR p."user" = ANY(as_uuid_array(NEW.client))) AND p.role = 'client';

      IF array_length(v_ids,1) IS NOT NULL THEN
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) - 1
        WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
      END IF;

    -- Transition: class -> non-class (refund for all OLD clients)
    ELSIF COALESCE(OLD.type,'') = 'class' AND COALESCE(NEW.type,'') <> 'class' THEN
      SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
      FROM public.profiles p
      WHERE (p.id = ANY(as_uuid_array(OLD.client)) OR p."user" = ANY(as_uuid_array(OLD.client))) AND p.role = 'client';

      IF array_length(v_ids,1) IS NOT NULL THEN
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) + 1
        WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
      END IF;

    -- Otherwise: both classes or both non-classes — keep add/remove behavior for class->class changes
    ELSE
      IF COALESCE(NEW.type,'') = 'class' OR COALESCE(OLD.type,'') = 'class' THEN
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
          UPDATE public.profiles p
          SET class_credits = COALESCE(class_credits, 0) - 1
          WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
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
          UPDATE public.profiles p
          SET class_credits = COALESCE(class_credits, 0) + 1
          WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."adjust_class_credits_on_events_change"() OWNER TO "postgres";