-- Add covering indexes for foreign keys reported by the linter (idempotent)
BEGIN;

CREATE INDEX IF NOT EXISTS idx_anatomy_company ON public.anatomy (company);
CREATE INDEX IF NOT EXISTS idx_classes_templates_company ON public.classes_templates (company);
CREATE INDEX IF NOT EXISTS idx_classes_templates_company1 ON public.classes_templates (company);
CREATE INDEX IF NOT EXISTS idx_equipment_company ON public.equipment (company);
CREATE INDEX IF NOT EXISTS idx_events_company ON public.events (company);
CREATE INDEX IF NOT EXISTS idx_exercises_company ON public.exercises (company);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles (company);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON public.profiles ("user");
CREATE INDEX IF NOT EXISTS idx_program_exercises_exercise ON public.program_exercises (exercise);
CREATE INDEX IF NOT EXISTS idx_program_exercises_program ON public.program_exercises (program);
CREATE INDEX IF NOT EXISTS idx_programs_company ON public.programs (company);
CREATE INDEX IF NOT EXISTS idx_programs_profile ON public.programs (profile);

COMMIT;