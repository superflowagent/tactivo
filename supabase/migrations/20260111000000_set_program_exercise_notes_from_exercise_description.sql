-- Set default notes for program_exercises from the referenced exercise description
-- If notes is NULL or empty on insert, populate it with exercises.description

-- Safety: drop existing trigger and function if present
DROP TRIGGER IF EXISTS trg_set_program_exercise_notes ON public.program_exercises;
DROP FUNCTION IF EXISTS public.fn_set_program_exercise_notes();

CREATE FUNCTION public.fn_set_program_exercise_notes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If notes is empty or NULL, attempt to copy description from exercises table
  IF (NEW.notes IS NULL OR TRIM(NEW.notes) = '') THEN
    NEW.notes := (SELECT description FROM public.exercises WHERE id = NEW.exercise LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_program_exercise_notes
BEFORE INSERT ON public.program_exercises
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_program_exercise_notes();
