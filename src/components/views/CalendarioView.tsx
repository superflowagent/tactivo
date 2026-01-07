import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FullCalendarLazy = lazy(() => import('./FullCalendarWrapper'));
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
// user_cards removed, load professionals from profiles directly
import './calendario.css';

export function CalendarioView() {
  const { companyId, user } = useAuth();
  const isClient = user?.role === 'client';
  const [events, setEvents] = useState<any[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
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
  const isMobile = useIsMobile();

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
    } catch (err) {
      logError('Error cargando créditos del usuario:', err);
      setClientCredits(0);
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
      const records = Array.isArray(rpcRecords) ? rpcRecords : rpcRecords ? [rpcRecords] : [];
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
        const clients = Array.isArray(event.client)
          ? event.client
          : event.client
            ? [event.client]
            : [];
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
          Array.isArray(event.client) ? event.client : event.client ? [event.client] : []
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
        if (event.type === 'appointment') {
          const expandedClient = expandedClients[0];
          title = expandedClient ? `${expandedClient.name} ${expandedClient.last_name}` : 'Cita';
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

        const startDate = parseDbDatetimeAsLocal(event.datetime) || new Date(event.datetime);
        const endDate = new Date(startDate.getTime() + (event.duration || 0) * 60000);
        const clientIds = Array.isArray(event.client) ? event.client : event.client ? [event.client] : [];
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

      setEvents(calendarEvents);
      setFilteredEvents(calendarEvents);
      loadClientCredits();
    } catch (err) {
      logError('Error cargando eventos:', err);
    }
  }, [companyId, loadClientCredits]);

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
      filtered = filtered.filter((event) => (event.extendedProps?.clientUserIds || []).includes(user.id));
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, selectedProfessional, showMyEvents, isClient, user?.id]);

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
        ...(Array.isArray(eventData.client)
          ? eventData.client
          : eventData.client
            ? [eventData.client]
            : []),
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

  const handleSave = () => {
    loadEvents();
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
      <Button onClick={isClient ? () => { } : handleAdd} className="w-full sm:hidden">
        <CalendarPlus className="mr-0 h-4 w-4" />
        {isClient ? 'Agendar cita' : 'Crear Evento'}
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

        <div className="hidden sm:block flex-1" />
        <Button onClick={isClient ? () => { } : handleAdd} className="hidden sm:flex">
          <CalendarPlus className="mr-0 h-4 w-4" />
          {isClient ? 'Agendar cita' : 'Crear Evento'}
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
                <FullCalendarLazy
                  initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
                  headerToolbar={{
                    left: isMobile ? 'prev,next' : 'prev,next today',
                    center: 'title',
                    right: isMobile ? 'today' : 'dayGridMonth,timeGridWeek,timeGridDay',
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
