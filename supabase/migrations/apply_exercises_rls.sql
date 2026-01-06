-- Enable row level security and create company-based policies for exercises, equipment and anatomy
-- This script is safe to re-run: it drops any matching policies first then creates them.

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
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.exercises;
CREATE POLICY "Company members can update" ON public.exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.exercises;
CREATE POLICY "Company members can delete" ON public.exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.exercises.company
    )
  );

-- EQUIPMENT
ALTER TABLE IF EXISTS public.equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can select" ON public.equipment;
CREATE POLICY "Company members can select" ON public.equipment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.equipment.company
    )
  );

DROP POLICY IF EXISTS "Company members can insert" ON public.equipment;
CREATE POLICY "Company members can insert" ON public.equipment
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.equipment;
CREATE POLICY "Company members can update" ON public.equipment
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.equipment.company
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.equipment;
CREATE POLICY "Company members can delete" ON public.equipment
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.equipment.company
    )
  );

-- ANATOMY
ALTER TABLE IF EXISTS public.anatomy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can select" ON public.anatomy;
CREATE POLICY "Company members can select" ON public.anatomy
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.anatomy.company
    )
  );

DROP POLICY IF EXISTS "Company members can insert" ON public.anatomy;
CREATE POLICY "Company members can insert" ON public.anatomy
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.anatomy;
CREATE POLICY "Company members can update" ON public.anatomy
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.anatomy.company
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = new.company
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.anatomy;
CREATE POLICY "Company members can delete" ON public.anatomy
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.anatomy.company
    )
  );

-- End of script
