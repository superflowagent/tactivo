-- Update RLS policies to restrict modifying operations to professionals/admins
-- This script is safe to re-run: it drops any matching policies first then creates them.

-- PROGRAMS
ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can select" ON public.programs;
CREATE POLICY "Company members can select" ON public.programs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company
    )
  );

DROP POLICY IF EXISTS "Company members can insert" ON public.programs;
CREATE POLICY "Company members can insert" ON public.programs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.programs;
CREATE POLICY "Company members can update" ON public.programs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.programs;
CREATE POLICY "Company members can delete" ON public.programs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

-- EXERCISES
ALTER TABLE IF EXISTS public.exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can select" ON public.exercises;
CREATE POLICY "Company members can select" ON public.exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company
    )
  );

DROP POLICY IF EXISTS "Company members can insert" ON public.exercises;
CREATE POLICY "Company members can insert" ON public.exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.exercises;
CREATE POLICY "Company members can update" ON public.exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.exercises;
CREATE POLICY "Company members can delete" ON public.exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

-- PROGRAM_EXERCISES
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
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.program_exercises;
CREATE POLICY "Company members can update" ON public.program_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.program_exercises;
CREATE POLICY "Company members can delete" ON public.program_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.program_exercises.company AND (p.role = 'professional' OR p.role = 'admin')
    )
  );
