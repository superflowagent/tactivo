-- Drop duplicate index for classes_templates (idx_classes_templates_company1)
BEGIN;

DROP INDEX IF EXISTS public.idx_classes_templates_company1;

COMMIT;