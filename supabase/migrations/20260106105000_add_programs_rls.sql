-- Add RLS policies for programs (company-based access)
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
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can update" ON public.programs;
CREATE POLICY "Company members can update" ON public.programs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can delete" ON public.programs;
CREATE POLICY "Company members can delete" ON public.programs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user = auth.uid() AND p.company = public.programs.company
    )
  );
