-- Create program_exercises link table
CREATE TABLE IF NOT EXISTS public.program_exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  exercise uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  company uuid,
  position integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS: ensure company members can access
ALTER TABLE IF EXISTS public.program_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can select" ON public.program_exercises;
CREATE POLICY "Company members can select" ON public.program_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company
    )
  );

DROP POLICY IF EXISTS "Company members can insert" ON public.program_exercises;
CREATE POLICY "Company members can insert" ON public.program_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.program_exercises;
CREATE POLICY "Company members can update" ON public.program_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.program_exercises;
CREATE POLICY "Company members can delete" ON public.program_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company
    )
  );
