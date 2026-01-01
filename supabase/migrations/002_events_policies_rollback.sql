-- Rollback migration for 002_events_policies.sql

DROP POLICY IF EXISTS events_select_company_members ON public.events;
DROP POLICY IF EXISTS events_insert_professionals ON public.events;
DROP POLICY IF EXISTS events_update_company_members ON public.events;
DROP POLICY IF EXISTS events_delete_company_members ON public.events;

-- (Do not disable RLS automatically; decide manually if desired.)
