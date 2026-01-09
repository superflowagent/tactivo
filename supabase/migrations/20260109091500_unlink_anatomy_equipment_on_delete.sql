-- Unlink deleted anatomy/equipment from exercises
-- and cleanup existing stale references

-- Function: unlink deleted anatomy from exercises
CREATE OR REPLACE FUNCTION public.unlink_deleted_anatomy_from_exercises()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove the deleted anatomy id from any exercise arrays
  UPDATE public.exercises ex
  SET anatomy = array_remove(ex.anatomy, OLD.id)
  WHERE OLD.id = ANY (ex.anatomy);
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.unlink_deleted_anatomy_from_exercises() IS
  'Removes deleted anatomy ID from exercises.anatomy array when an anatomy row is deleted.';

-- Trigger for anatomy deletes
DROP TRIGGER IF EXISTS trg_unlink_anatomy_from_exercises ON public.anatomy;
CREATE TRIGGER trg_unlink_anatomy_from_exercises
AFTER DELETE ON public.anatomy
FOR EACH ROW EXECUTE FUNCTION public.unlink_deleted_anatomy_from_exercises();

-- Function: unlink deleted equipment from exercises
CREATE OR REPLACE FUNCTION public.unlink_deleted_equipment_from_exercises()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove the deleted equipment id from any exercise arrays
  UPDATE public.exercises ex
  SET equipment = array_remove(ex.equipment, OLD.id)
  WHERE OLD.id = ANY (ex.equipment);
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.unlink_deleted_equipment_from_exercises() IS
  'Removes deleted equipment ID from exercises.equipment array when an equipment row is deleted.';

-- Trigger for equipment deletes
DROP TRIGGER IF EXISTS trg_unlink_equipment_from_exercises ON public.equipment;
CREATE TRIGGER trg_unlink_equipment_from_exercises
AFTER DELETE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.unlink_deleted_equipment_from_exercises();

-- One-time cleanup to remove any non-existent references already stored
-- Assumes exercises.anatomy and exercises.equipment are of type uuid[] (common setup)
-- If they are text[], these casts may need adjusting.

-- Cleanup anatomy references
UPDATE public.exercises ex
SET anatomy = (
  SELECT COALESCE(array_agg(a.id), '{}'::uuid[])
  FROM unnest(COALESCE(ex.anatomy, '{}'::uuid[])) AS x(id)
  JOIN public.anatomy a ON a.id = x.id
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(ex.anatomy, '{}'::uuid[])) AS x(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.anatomy a WHERE a.id = x.id)
);

-- Cleanup equipment references
UPDATE public.exercises ex
SET equipment = (
  SELECT COALESCE(array_agg(e2.id), '{}'::uuid[])
  FROM unnest(COALESCE(ex.equipment, '{}'::uuid[])) AS x(id)
  JOIN public.equipment e2 ON e2.id = x.id
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(ex.equipment, '{}'::uuid[])) AS x(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.equipment e3 WHERE e3.id = x.id)
);
