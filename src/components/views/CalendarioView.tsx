import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FullCalendarLazy = lazy(() => import('./FullCalendarWrapper'));
import CalendarioList from './CalendarioList';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarPlus, AlertTriangle, Dumbbell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';
import type { Event } from '@/types/event';
import type { Company } from '@/types/company';
import { EventDialog } from '@/components/eventos/EventDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeForSearch } from '@/lib/stringUtils'
import { parseDbDatetimeAsLocal } from '@/lib/utils';
import { formatDateWithOffset } from '@/lib/date';
import { getFilePublicUrl } from '@/lib/supabase';
import { getProfilesByIds, getProfilesByRole } from '@/lib/profiles';
import { AppointmentSlotsDialog } from '@/components/eventos/AppointmentSlotsDialog';
// user_cards removed, load professionals from profiles directly
import './calendario.css';

export function CalendarioView() {
  const { companyId, user } = useAuth();
  const isClient = user?.role === 'client';
  const [events, setEvents] = useState<any[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
  // Keep the full list of calendar events (including vacations) for logic such as
  // availability calculations; UI for clients will hide vacation rows while the
  // dialog will still receive the full list.
  const [allCalendarEvents, setAllCalendarEvents] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [clickedDateTime, setClickedDateTime] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [showMyEvents, setShowMyEvents] = useState<boolean>(false); // Toggle for clients: show only events where user is an attendee
  const [company, setCompany] = useState<Company | null>(null);
  // Client credits state (only used when logged in as a client)
  const [clientCredits, setClientCredits] = useState<number | null>(null);
  // The profile id for the logged in user (used to match events where client is a profile id)
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  // Dialog to show appointment slots (for clients)
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  // Vista seleccionada ('Mes' | 'Semana' | 'Día' | 'Lista')
  const [selectedView, setSelectedView] = useState<string>(isMobile ? 'Día' : 'Semana');
  const calendarRef = useRef<any>(null);

  // Normalize client field variants (some RPCs return client_user_ids / clientUserIds / clients etc.)
  const getClientIdsFromEvent = (ev: any) => {
    if (!ev) return [];
    if (Array.isArray(ev.client)) return ev.client;
    if (ev.client) return [ev.client];
    if (Array.isArray(ev.client_user_ids)) return ev.client_user_ids;
    if (ev.client_user_ids) return [ev.client_user_ids];
    if (Array.isArray(ev.clientUserIds)) return ev.clientUserIds;
    if (ev.clientUserIds) return [ev.clientUserIds];
    if (Array.isArray(ev.clients)) return ev.clients;
    if (ev.clients) return [ev.clients];
    if (Array.isArray(ev.clientIds)) return ev.clientIds;
    if (ev.clientIds) return [ev.clientIds];
    return [];
  };

  // Avoid frequent reloads (e.g., when returning from another tab)
  // by tracking last load time and ignoring reload attempts that happen
  // within a short interval.
  const lastEventsLoadRef = useRef<number>(0);

  // Load the client's `class_credits` from the `users` collection (uses view rules)
  const loadClientCredits = useCallback(async () => {
    if (!isClient || !user?.id) return;

    try {
      const fetcher = await import('@/lib/supabase');
      const profile = await fetcher.fetchProfileByUserId(user.id);
      setClientCredits(profile?.class_credits ?? 0);
      setMyProfileId(profile?.id ?? null);
    } catch (err) {
      logError('Error cargando créditos del usuario:', err);
      setClientCredits(0);
      setMyProfileId(null);
    }
  }, [isClient, user?.id]);

  const loadProfessionals = useCallback(async () => {
    if (!companyId) return;

    try {
      const profiles = await getProfilesByRole(companyId!, 'professional');
      const records = (profiles || []).map((p: any) => ({
        id: p.user_id || p.user || p.id,
        user: p.user_id || p.user || p.id,
        name: p.name || '',
        last_name: p.last_name || '',
        photo: p.photo_path || null,
        photoUrl: p.photo_path
          ? getFilePublicUrl('profile_photos', p.user || p.id, p.photo_path)
          : null,
        role: p.role || null,
        company: p.company || null,
      }));
      setProfessionals(records);
    } catch (err) {
      logError('Error cargando profesionales desde profiles:', err);
    }
  }, [companyId]);

  const loadCompany = useCallback(async () => {
    if (!companyId) return;

    try {
      const { data: comp, error: compErr } = await supabase.rpc('get_company_by_id', {
        p_company: companyId,
      });
      if (compErr) throw compErr;
      const record = Array.isArray(comp) ? comp[0] : comp;
      setCompany(record);
    } catch (err) {
      logError('Error cargando configuración de company:', err);
    }
  }, [companyId]);

  const loadEvents = useCallback(async (force = false) => {
    if (!companyId) return;

    try {
      // Avoid reload storm when returning to tab: if last load was less than 10s ago, skip unless forced
      const last = lastEventsLoadRef.current;
      const now = Date.now();
      if (!force && last && now - last < 10000) return;
      lastEventsLoadRef.current = now;

      // Cargar eventos de la company actual
      const cid = companyId;
      const { data: rpcRecords, error } = await supabase.rpc('get_events_for_company', {
        p_company: cid,
      });
      if (error) throw error;
      let records = Array.isArray(rpcRecords) ? rpcRecords : rpcRecords ? [rpcRecords] : [];

      // DEV/WORKAROUND: If RPC omitted vacation rows, fetch them directly and merge.
      // Observed: some vacations may not be returned by `get_events_for_company` but still exist
      // in the `events` table (seen during local debugging). To avoid showing incorrect
      // availability to clients, explicitly fetch vacations for the near future and merge.
      try {
        const nowIso = new Date().toISOString();
        const oneYearIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const { data: vacRows, error: vacErr } = await supabase
          .from('events')
          .select('*')
          .eq('company', cid)
          .eq('type', 'vacation')
          .gte('datetime', nowIso)
          .lte('datetime', oneYearIso);
        if (!vacErr && Array.isArray(vacRows) && vacRows.length > 0) {
          // Find vacations that are not present in RPC results and append them
          const existingIds = new Set(records.map((r: any) => r.id));
          const missing = vacRows.filter((v: any) => !existingIds.has(v.id));
          if (missing.length > 0) {
            records = [...records, ...missing];
            // sort again by datetime after merge
            records.sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
          }
        }
      } catch (e) {
        // ignore fallback failures, RPC data is primary
      }
      // Sort by datetime
      records.sort(
        (a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );

      // Precompute profile ids to fetch
      const allIds = new Set<string>();
      (records || []).forEach((event: any) => {
        const pros = Array.isArray(event.professional)
          ? event.professional
          : event.professional
            ? [event.professional]
            : [];
        const clients = getClientIdsFromEvent(event);
        pros.forEach((id: string) => allIds.add(id));
        clients.forEach((id: string) => allIds.add(id));
      });

      let profileMap: Record<string, any> = {};
      if (allIds.size > 0) {
        const ids = Array.from(allIds);
        const profilesMap = await getProfilesByIds(ids, companyId ?? undefined);
        profileMap = profilesMap || {};
      }

      // Transformar eventos para FullCalendar
      const calendarEvents = (records || []).map((event: any) => {
        let title = '';
        let backgroundColor = '';
        let borderColor = '';

        const expandedClients = (
          getClientIdsFromEvent(event)
        )
          .map((id: string) => profileMap[id])
          .filter(Boolean);
        const expandedProfessionals = (
          Array.isArray(event.professional)
            ? event.professional
            : event.professional
              ? [event.professional]
              : []
        )
          .map((id: string) => profileMap[id])
          .filter(Boolean);

        // Construir strings con nombres para búsqueda
        const clientNames = expandedClients.map((c: any) => `${c.name} ${c.last_name}`).join(', ');
        const professionalNames = expandedProfessionals
          .map((p: any) => `${p.name} ${p.last_name}`)
          .join(', ');

        // Determinar título y color según tipo
        // Debug: if a specific event is missing client resolution, log helpful diagnostics in development
        if (process.env.NODE_ENV === 'development' && event.id === '8ccbeb2d-a345-444d-97a5-4cadf128741d' && (!expandedClients || expandedClients.length === 0)) {
          // eslint-disable-next-line no-console
          console.debug('Calendario: missing expandedClients for event', {
            id: event.id,
            rawClientFields: getClientIdsFromEvent(event),
            profileMapKeys: Object.keys(profileMap),
            rawEvent: event,
          });
        }

        if (event.type === 'appointment') {
          // For appointments show the client name to professionals (first client if multiple), otherwise keep the existing "Cita - Nombre Apellido" format when there's exactly one client
          const expandedClient = expandedClients.length === 1 ? expandedClients[0] : null;
          const isProfessional = user?.role === 'professional';
          if (isProfessional) {
            // Prefer expanded client data; if absent, fall back to any precomputed clientNames on the raw event
            if (expandedClients.length > 0) {
              const c = expandedClients[0];
              title = `${c.name} ${c.last_name}`;
            } else if (clientNames) {
              title = clientNames.split(', ')[0];
            } else if (event.client && typeof event.client === 'string') {
              // If client is a single id but couldn't be resolved, show placeholder 'Cita'
              title = 'Cita';
            } else {
              title = 'Cita';
            }
          } else {
            title = expandedClient ? `Cita - ${expandedClient.name} ${expandedClient.last_name}` : 'Cita';
          }
          backgroundColor = 'hsl(var(--appointment-color))';
          borderColor = 'hsl(var(--appointment-color))';
        } else if (event.type === 'class') {
          title = 'Clase';
          backgroundColor = 'hsl(var(--class-color))';
          borderColor = 'hsl(var(--class-color))';
        } else if (event.type === 'vacation') {
          title = professionalNames || 'Vacaciones';
          backgroundColor = 'hsl(var(--vacation-color))';
          borderColor = 'hsl(var(--vacation-color))';
        }

        // Normalize incoming datetime strings so that values without explicit timezone
        // offset are interpreted as local wall-clock times consistently. This ensures
        // vacation events behave the same as appointments/classes irrespective of
        // how the DB stored the datetime (with or without offset).
        const normalizeDatetime = (dt: any) => {
          if (!dt) return dt;
          const s = String(dt);
          // If contains explicit timezone (Z or +hh:mm), leave as-is
          if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) return s;
          // Otherwise parse into a Date using local interpretation and reformat with offset
          try {
            const parsed = new Date(s);
            return formatDateWithOffset(parsed);
          } catch (e) {
            return s;
          }
        };
        const startDate = new Date(normalizeDatetime(event.datetime));
        const endDate = new Date(startDate.getTime() + (event.duration || 0) * 60000);
        const clientIds = getClientIdsFromEvent(event);
        const clientUserIds = expandedClients.map((c: any) => c.user || c.id).filter(Boolean);

        return {
          id: event.id,
          title,
          start: startDate,
          end: endDate,
          backgroundColor,
          borderColor,
          extendedProps: {
            type: event.type,
            cost: event.cost,
            paid: event.paid,
            notes: event.notes,
            professional: Array.isArray(event.professional) ? event.professional : event.professional ? [event.professional] : [],
            client: clientIds,
            clientUserIds, // normalized user ids for robust matching
            clientNames,
            professionalNames,
          },
          _rawEvent: event,
        };
      });

      // Preserve the full set (including vacations) for components which need them
      setAllCalendarEvents(calendarEvents);

      // For client users, hide 'vacation' events from the calendar UI but keep them
      // in the full dataset so the appointment dialog can still block those times.
      const eventsForDisplay = isClient
        ? calendarEvents.filter((e: any) => {
          const t = e._rawEvent?.type || e.extendedProps?.type || e.type;
          return t !== 'vacation';
        })
        : calendarEvents;

      setEvents(eventsForDisplay);
      setFilteredEvents(eventsForDisplay);
      loadClientCredits();
    } catch (err) {
      logError('Error cargando eventos:', err);
    }
  }, [companyId, loadClientCredits, user?.role]);

  const filterEvents = useCallback(() => {
    let filtered = [...events];

    // Filtrar por búsqueda de texto
    if (searchQuery) {
      const q = normalizeForSearch(searchQuery);
      filtered = filtered.filter((event) => {
        const title = String(event.title || '');
        const notes = String(event.extendedProps?.notes || '');
        const clientNames = String(event.extendedProps?.clientNames || '');
        const professionalNames = String(event.extendedProps?.professionalNames || '');
        const combined = `${title} ${notes} ${clientNames} ${professionalNames}`;
        return normalizeForSearch(combined).includes(q);
      });
    }

    // Filtrar por profesional
    if (selectedProfessional && selectedProfessional !== 'all') {
      filtered = filtered.filter((event) => {
        return (event.extendedProps?.professional || []).includes(selectedProfessional);
      });
    }

    // Mostrar solo mis eventos si es cliente
    if (showMyEvents && isClient && user?.id) {
      filtered = filtered.filter((event) => {
        const clientUserIds = event.extendedProps?.clientUserIds || [];
        const clientProfileIds = event.extendedProps?.client || [];
        // Match if any of:
        // - clientUserIds includes the auth user id (common case when profile.user is set)
        // - clientProfileIds includes the user's profile id (covers profiles without linked user)
        // - clientProfileIds includes the auth user id (defensive: some data may use user id as profile id)
        return (
          clientUserIds.includes(user.id) ||
          (myProfileId && clientProfileIds.includes(myProfileId)) ||
          clientProfileIds.includes(user.id)
        );
      });
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, selectedProfessional, showMyEvents, isClient, user?.id, myProfileId]);

  // Load company, events and professionals when the companyId changes only
  useEffect(() => {
    if (!companyId) return;
    // Ensure the calendar prefetch and initial load happen once when company is known
    loadCompany();
    loadProfessionals();
    loadEvents(true); // force the initial load
    // keep last load timestamp to avoid noisy reloads on tab visibility changes
  }, [companyId, loadCompany, loadProfessionals, loadEvents]);

  // Load client credits only when client state or user id changes
  useEffect(() => {
    if (isClient && user?.id) {
      loadClientCredits();
    }
  }, [isClient, user?.id, loadClientCredits]);

  useEffect(() => {
    filterEvents();
  }, [filterEvents]);

  // Si cambiamos la vista (desde el selector), pedir al calendario que cambie de vista
  useEffect(() => {
    if (selectedView === 'Lista') return;
    const viewName = selectedView === 'Mes' ? 'dayGridMonth' : selectedView === 'Día' ? 'timeGridDay' : 'timeGridWeek';
    const api = calendarRef.current?.getApi?.();
    if (api && typeof api.changeView === 'function') {
      api.changeView(viewName);
    }
  }, [selectedView]);

  const handleDateClick = (arg: any) => {
    // Clientes no pueden crear eventos desde el calendario (sin funcionalidad por ahora)
    if (isClient) return;

    // Abrir modal de crear evento con la fecha/hora clickeada
    setClickedDateTime(arg.dateStr);
    setSelectedEvent(null);
    setDialogOpen(true);
  };

  const handleEventClick = async (clickInfo: any) => {
    const eventId = clickInfo.event.id;

    try {
      // Use secure RPC to fetch event and avoid direct SELECT that may trigger profiles RLS
      const { data: rpcRecords, error } = await supabase.rpc('get_events_for_company', {
        p_company: companyId,
      });
      if (error) throw error;
      const records = Array.isArray(rpcRecords) ? rpcRecords : rpcRecords ? [rpcRecords] : [];
      const eventData = (records || []).find((r: any) => r.id === eventId);
      if (!eventData) throw new Error('event not found');

      // Enrich with profiles
      const ids = [
        ...getClientIdsFromEvent(eventData),
        ...(Array.isArray(eventData.professional)
          ? eventData.professional
          : eventData.professional
            ? [eventData.professional]
            : []),
      ];
      let profileMap: Record<string, any> = {};
      if (ids.length > 0) {
        const profilesMap = await getProfilesByIds(ids, companyId ?? undefined);
        profileMap = profilesMap || {};
      }

      const enriched = {
        ...eventData,
        expand: {
          client: (Array.isArray(eventData.client)
            ? eventData.client
            : eventData.client
              ? [eventData.client]
              : []
          )
            .map((id: string) => profileMap[id] || null)
            .filter(Boolean),
          professional: (Array.isArray(eventData.professional)
            ? eventData.professional
            : eventData.professional
              ? [eventData.professional]
              : []
          )
            .map((id: string) => profileMap[id] || null)
            .filter(Boolean),
        },
      };

      setSelectedEvent(enriched as any);
      setDialogOpen(true);
    } catch (err) {
      logError('Error cargando evento:', err);
    }
  };

  const handleAdd = () => {
    if (isClient) return; // No-op for clients (show 'Agendar cita' button without functionality)
    setClickedDateTime(null);
    setSelectedEvent(null);
    setDialogOpen(true);
  };

  // Open appointment dialog for clients after fetching latest professionals and events
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const handleOpenAppointmentDialog = async () => {
    if (!isClient) return;
    try {
      setAppointmentLoading(true);
      // Ensure we have the freshest data before showing slots
      await loadProfessionals();
      await loadEvents(true); // force reload
      setAppointmentDialogOpen(true);
    } catch (err) {
      logError('Error opening appointment dialog:', err);
      setAppointmentDialogOpen(true); // still open dialog to surface any messages
    } finally {
      setAppointmentLoading(false);
    }
  };

  const handleSave = (force: boolean = false) => {
    // Refresh events and client credits (so "Clases restantes" updates when a client signs/un-signs)
    loadEvents(force);
    loadClientCredits();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedProfessional('all');
  };

  const handleEventDrop = async (info: any) => {
    try {
      const eventId = info.event.id;
      const newStart = info.event.start;

      // Actualizar en Supabase using timezone-less local format to preserve wall-clock time
      const { error } = await supabase.rpc('update_event_json', {
        p_payload: { id: eventId, changes: { datetime: formatDateWithOffset(newStart) } },
      });
      if (error) throw error;

      // Recargar eventos
      loadEvents();
    } catch (err) {
      logError('Error moviendo evento:', err);
      info.revert(); // Revertir si falla
    }
  };

  const handleEventResize = async (info: any) => {
    try {
      const eventId = info.event.id;
      const newStart = info.event.start;
      const newEnd = info.event.end;

      // Calcular nueva duración en minutos
      const durationMs = newEnd.getTime() - newStart.getTime();
      const durationMin = Math.round(durationMs / (1000 * 60));

      // Actualizar en Supabase using timezone-less local format to preserve wall-clock time
      const { error } = await supabase.rpc('update_event_json', {
        p_payload: {
          id: eventId,
          changes: { datetime: formatDateWithOffset(newStart), duration: durationMin },
        },
      });
      if (error) throw error;

      // Recargar eventos
      loadEvents();
    } catch (err) {
      logError('Error redimensionando evento:', err);
      info.revert(); // Revertir si falla
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      {/* Botón crear - siempre arriba en móvil */}
      <Button onClick={isClient ? handleOpenAppointmentDialog : handleAdd} disabled={isClient && appointmentLoading} className="w-full sm:hidden">
        <CalendarPlus className="mr-0 h-4 w-4" />
        {isClient ? (appointmentLoading ? 'Cargando...' : 'Agendar cita') : 'Crear Evento'}
      </Button>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <Input
          placeholder="Buscar eventos..."
          className="section-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {!isClient ? (
          <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
            <SelectTrigger className="section-search">
              <SelectValue placeholder="Profesional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los profesionales</SelectItem>
              {professionals.map((prof) => (
                <SelectItem key={prof.user} value={prof.user}>
                  {prof.name} {prof.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-3">
            <label htmlFor="show-my-events" className="text-sm font-medium cursor-pointer">
              Ver mis eventos
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                id="show-my-events"
                type="checkbox"
                className="peer sr-only"
                checked={showMyEvents}
                onChange={(e) => setShowMyEvents(e.target.checked)}
              />
              <div className="h-5 w-9 rounded-full bg-muted relative peer-checked:bg-primary transition-colors">
                <div
                  className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-background shadow transform transition-transform ${showMyEvents ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </div>
            </label>
          </div>
        )}


        {(searchQuery || selectedProfessional !== 'all') && (
          <Button variant="outline" onClick={handleClearFilters} className="w-full sm:w-auto">
            Limpiar filtros
          </Button>
        )}

        {isClient && (
          <div className="flex items-center gap-3 sm:ml-4">
            <div className="flex items-center text-sm font-medium">
              Clases restantes: <span className="font-bold ml-1">{clientCredits ?? 0}</span>
              {(clientCredits ?? 0) <= 0 && (
                <span className="ml-2 inline-block" role="img" aria-label="Créditos insuficientes">
                  <AlertTriangle className="h-4 w-4 text-orange-600" aria-hidden="true" />
                </span>
              )}
            </div>
          </div>
        )}

        <AppointmentSlotsDialog
          open={appointmentDialogOpen}
          onOpenChange={setAppointmentDialogOpen}
          company={company}
          // Pass the full set of events (including vacations) so the dialog can
          // correctly block slots even if vacations are hidden from the calendar UI
          events={allCalendarEvents}
          professionals={professionals}
        />

        <div className="hidden sm:block flex-1" />
        <Button onClick={isClient ? handleOpenAppointmentDialog : handleAdd} disabled={isClient && appointmentLoading} className="hidden sm:flex">
          <CalendarPlus className="mr-0 h-4 w-4" />
          {isClient ? (appointmentLoading ? 'Cargando...' : 'Agendar cita') : 'Crear Evento'}
        </Button>
      </div>

      <Card className="flex-1">
        <CardContent className="pt-6 flex-1 min-h-0">
          <Suspense fallback={<div className="text-center py-8">Cargando calendario…</div>}>
            {/* Render calendar even if no company row exists: use defaults when company is null */}
            {(() => {
              const openTime = company?.open_time || '08:00';
              const closeTime = company?.close_time || '20:00';

              return (
                <div className={`calendar-wrapper ${selectedView === 'Lista' ? 'calendar--list' : ''}`}>
                  <FullCalendarLazy
                    ref={calendarRef}
                    initialView={selectedView === 'Mes' ? 'dayGridMonth' : selectedView === 'Día' ? 'timeGridDay' : 'timeGridWeek'}
                    headerToolbar={{
                      left: isMobile ? 'prev,next' : 'prev,next today',
                      center: 'title',
                      right: isMobile ? 'today,listButton' : 'dayGridMonth,timeGridWeek,timeGridDay,listButton',
                    }}
                    customButtons={{
                      listButton: {
                        text: 'Lista',
                        click: () => setSelectedView('Lista'),
                      },
                    }}
                    buttonText={{
                      today: 'Hoy',
                      month: 'Mes',
                      week: 'Semana',
                      day: 'Día',
                    }}
                    slotMinTime={openTime}
                    slotMaxTime={closeTime}
                    allDaySlot={false}
                    height="100%"
                    contentHeight="auto"
                    slotDuration="00:30:00"
                    events={filteredEvents}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    datesSet={(arg: any) => {
                      // Keep the external selector in sync with built-in calendar buttons
                      const t = arg.view.type;
                      if (t === 'dayGridMonth') setSelectedView('Mes');
                      else if (t === 'timeGridDay') setSelectedView('Día');
                      else setSelectedView('Semana');
                    }}
                    editable={true}
                    selectable={!isClient}
                    selectMirror={!isClient}
                    dayMaxEvents={true}
                    weekends={true}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    titleFormat={isMobile ? { month: 'short', day: 'numeric' } : undefined}
                    dayHeaderFormat={isMobile ? { weekday: 'short', day: 'numeric' } : undefined}
                  />

                  {selectedView === 'Lista' && (
                    <div className="calendar-list-slot mt-0">
                      <CalendarioList events={filteredEvents} onRowClick={handleEventClick} onDeleteComplete={() => loadEvents(true)} canDelete={!isClient} />
                    </div>
                  )}
                </div>
              );
            })()}
          </Suspense>
        </CardContent>
      </Card>

      {isClient && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="mr-2 h-4 w-4" />
              Programas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Aquí verás los programas que tienes asignados.
            </div>
          </CardContent>
        </Card>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        onSave={handleSave}
        initialDateTime={clickedDateTime}
      />
    </div>
  );
}
