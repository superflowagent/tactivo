-- Migration: Remove event helper functions and RLS policies added during debugging

BEGIN;

-- Remove policies on events that were added by the previous migrations
DROP POLICY IF EXISTS allow_select_events_for_members ON public.events;
DROP POLICY IF EXISTS allow_insert_events_for_professionals ON public.events;
DROP POLICY IF EXISTS allow_update_events_for_members ON public.events;
DROP POLICY IF EXISTS allow_delete_events_for_professionals ON public.events;

-- Remove helper functions and RPCs added
DROP FUNCTION IF EXISTS public.is_professional_of_company(uuid);
DROP FUNCTION IF EXISTS public.insert_event(text,text,int,numeric,boolean,text,text,uuid[],uuid[],uuid);
DROP FUNCTION IF EXISTS public.update_event(uuid,jsonb);
DROP FUNCTION IF EXISTS public.delete_event(uuid);
DROP FUNCTION IF EXISTS public.get_events_by_company(uuid);
DROP FUNCTION IF EXISTS public.get_event_by_id(uuid);
DROP FUNCTION IF EXISTS public.insert_event_json(jsonb);

COMMIT;
