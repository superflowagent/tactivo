import { useState, useEffect, lazy, Suspense } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const FullCalendarLazy = lazy(() => import('./FullCalendarWrapper'))
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarPlus, AlertTriangle } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { error as logError } from '@/lib/logger'
import type { Event } from '@/types/event'
import type { Company } from '@/types/company'
import { EventDialog } from '@/components/eventos/EventDialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeForSearch, parseDbDatetimeAsLocal, formatDateAsDbLocalString } from '@/lib/utils'
import { getFilePublicUrl } from '@/lib/supabase'
// user_cards removed, load professionals from profiles directly
import './calendario.css'

export function CalendarioView() {
  const { companyId, user } = useAuth()
  const isClient = user?.role === 'client'
  const [events, setEvents] = useState<any[]>([])
  const [filteredEvents, setFilteredEvents] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [clickedDateTime, setClickedDateTime] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all')
  const [professionals, setProfessionals] = useState<any[]>([])
  const [showMyEvents, setShowMyEvents] = useState<boolean>(false) // Toggle for clients: show only events where user is an attendee
  const [company, setCompany] = useState<Company | null>(null)
  // Client credits state (only used when logged in as a client)
  const [clientCredits, setClientCredits] = useState<number | null>(null)
  const isMobile = useIsMobile()

  // Load company, events and professionals when the companyId changes only
  useEffect(() => {
    if (!companyId) return
    // Ensure the calendar prefetch and initial load happen once when company is known
    loadCompany()
    loadProfessionals()
    loadEvents(true) // force the initial load
    // keep last load timestamp to avoid noisy reloads on tab visibility changes
  }, [companyId])

  // Load client credits only when client state or user id changes
  useEffect(() => {
    if (isClient && user?.id) {
      loadClientCredits()
    }
  }, [isClient, user?.id])

  // Avoid frequent reloads (e.g., when returning from another tab)
  // by tracking last load time and ignoring reload attempts that happen
  // within a short interval.
  const lastEventsLoadRef = (function () {
    // keep a stable ref via closure - simple alternative to useRef in this module
    let last = 0
    return {
      get: () => last,
      set: (v: number) => { last = v }
    }
  })()


  // Load the client's `class_credits` from the `users` collection (uses view rules)
  const loadClientCredits = async () => {
    if (!isClient || !user?.id) return

    try {
      const fetcher = await import('@/lib/supabase')
      const profile = await fetcher.fetchProfileByUserId(user.id)
      setClientCredits(profile?.class_credits ?? 0)
    } catch (err) {
      logError('Error cargando créditos del usuario:', err)
      setClientCredits(0)
    }
  }

  useEffect(() => {
    filterEvents()
  }, [events, searchQuery, selectedProfessional, showMyEvents, isClient, user?.id])

  const loadProfessionals = async () => {
    if (!companyId) return

    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, user, name, last_name, photo_path, role, company')
        .eq('company', companyId)
        .eq('role', 'professional')
        .order('name')
      if (error) throw error
      const records = (profiles || []).map((p: any) => ({
        id: p.user || p.id,
        user: p.user || p.id,
        name: p.name || '',
        last_name: p.last_name || '',
        photo: p.photo_path || null,
        photoUrl: p.photo_path ? getFilePublicUrl('profile_photos', p.user || p.id, p.photo_path) : null,
        role: p.role || null,
        company: p.company || null,
      }))
      setProfessionals(records)
    } catch (err) {
      logError('Error cargando profesionales desde profiles:', err)
    }
  }

  const loadCompany = async () => {
    if (!companyId) return

    try {
      const { data: record, error } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
      if (error) throw error
      setCompany(record)
    } catch (err) {
      logError('Error cargando configuración de company:', err)
    }
  }

  const filterEvents = () => {
    let filtered = [...events]

    // Filtrar por búsqueda de texto
    if (searchQuery) {
      const q = normalizeForSearch(searchQuery)
      filtered = filtered.filter(event => {
        const titleMatch = event.title && normalizeForSearch(event.title).includes(q)
        const notesMatch = event.extendedProps?.notes && normalizeForSearch(event.extendedProps.notes).includes(q)
        const clientMatch = event.extendedProps?.clientNames && normalizeForSearch(event.extendedProps.clientNames).includes(q)
        const professionalMatch = event.extendedProps?.professionalNames && normalizeForSearch(event.extendedProps.professionalNames).includes(q)
        return Boolean(titleMatch || notesMatch || clientMatch || professionalMatch)
      })
    }

    // Filtrar por profesional (por id)
    if (selectedProfessional !== 'all') {
      filtered = filtered.filter(event =>
        event.extendedProps?.professional?.includes(selectedProfessional)
      )
    }

    // Si el toggle 'Ver mis eventos' está activo para clientes, filtrar por cliente actual
    if (showMyEvents && isClient && user?.id) {
      filtered = filtered.filter(event => {
        const clients = event.extendedProps?.client || []
        return Array.isArray(clients) && clients.includes(user.id)
      })
    }

    setFilteredEvents(filtered)
  }

  const loadEvents = async (force = false) => {
    if (!companyId) return

    try {
      // Avoid reload storm when returning to tab: if last load was less than 10s ago, skip unless forced
      const last = lastEventsLoadRef.get()
      const now = Date.now()
      if (!force && last && (now - last) < 10000) return
      lastEventsLoadRef.set(now)

      // Cargar eventos de la company actual
      const cid = companyId
      const { data: records, error } = await supabase.from('events').select('*').eq('company', cid).order('datetime')
      if (error) throw error

      // Precompute profile ids to fetch
      const allIds = new Set<string>()
        ; (records || []).forEach((event: any) => {
          const pros = Array.isArray(event.professional) ? event.professional : (event.professional ? [event.professional] : [])
          const clients = Array.isArray(event.client) ? event.client : (event.client ? [event.client] : [])
          pros.forEach((id: string) => allIds.add(id))
          clients.forEach((id: string) => allIds.add(id))
        })

      let profileMap: Record<string, any> = {}
      if (allIds.size > 0) {
        const ids = Array.from(allIds)
        // Try by 'user' column first, fallback to 'id'
        let profiles: any[] = []
        try {
          const r = await supabase.from('profiles').select('id, user, name, last_name').in('user', ids)
          profiles = r?.data || []
        } catch {
          profiles = []
        }
        if ((!profiles || profiles.length === 0) && ids.length > 0) {
          const r2 = await supabase.from('profiles').select('id, user, name, last_name').in('id', ids)
          profiles = r2?.data || []
        }
        if ((!profiles || profiles.length === 0) && ids.length > 0) {
          const r3 = await supabase.from('profiles').select('id, user, name, last_name').in('id', ids)
          profiles = r3?.data || []
        }
        ; (profiles || []).forEach((p: any) => { const uid = p.user || p.id; profileMap[uid] = p })
      }

      // Transformar eventos para FullCalendar
      const calendarEvents = (records || []).map((event: any) => {
        let title = ''
        let backgroundColor = ''
        let borderColor = ''

        const expandedClients = (Array.isArray(event.client) ? event.client : (event.client ? [event.client] : [])).map((id: string) => profileMap[id]).filter(Boolean)
        const expandedProfessionals = (Array.isArray(event.professional) ? event.professional : (event.professional ? [event.professional] : [])).map((id: string) => profileMap[id]).filter(Boolean)

        // Construir strings con nombres para búsqueda
        const clientNames = expandedClients.map((c: any) => `${c.name} ${c.last_name}`).join(', ')
        const professionalNames = expandedProfessionals.map((p: any) => `${p.name} ${p.last_name}`).join(', ')

        // Determinar título y color según tipo
        if (event.type === 'appointment') {
          const expandedClient = expandedClients[0]
          title = expandedClient ? `${expandedClient.name} ${expandedClient.last_name}` : 'Cita'
          backgroundColor = 'hsl(var(--appointment-color))'
          borderColor = 'hsl(var(--appointment-color))'
        } else if (event.type === 'class') {
          title = 'Clase'
          backgroundColor = 'hsl(var(--class-color))'
          borderColor = 'hsl(var(--class-color))'
        } else if (event.type === 'vacation') {
          title = professionalNames || 'Vacaciones'
          backgroundColor = 'hsl(var(--vacation-color))'
          borderColor = 'hsl(var(--vacation-color))'
        }

        const startDate = parseDbDatetimeAsLocal(event.datetime) || new Date(event.datetime)
        const endDate = new Date(startDate.getTime() + (event.duration || 0) * 60000)
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
            professional: event.professional,
            client: event.client || [],
            clientNames,
            professionalNames,
          },
          _rawEvent: event
        }
      })

      setEvents(calendarEvents)
      setFilteredEvents(calendarEvents)
      loadClientCredits()
    } catch (err) {
      logError('Error cargando eventos:', err)
    }
  }

  const handleDateClick = (arg: any) => {
    // Clientes no pueden crear eventos desde el calendario (sin funcionalidad por ahora)
    if (isClient) return

    // Abrir modal de crear evento con la fecha/hora clickeada
    setClickedDateTime(arg.dateStr)
    setSelectedEvent(null)
    setDialogOpen(true)
  }

  const handleEventClick = async (clickInfo: any) => {
    const eventId = clickInfo.event.id

    try {
      const { data: eventData, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
      if (error) throw error

      // Enrich with profiles
      const ids = [...(Array.isArray(eventData.client) ? eventData.client : (eventData.client ? [eventData.client] : [])), ...(Array.isArray(eventData.professional) ? eventData.professional : (eventData.professional ? [eventData.professional] : []))]
      let profileMap: Record<string, any> = {}
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, user, name, last_name').in('user', ids)
        const fallback = (!profiles || profiles.length === 0) ? (await supabase.from('profiles').select('id, user, name, last_name').in('id', ids)).data || [] : profiles
          ; ((profiles || fallback) || []).forEach((p: any) => { const uid = p.user || p.id; profileMap[uid] = p })
      }

      const enriched = {
        ...eventData,
        expand: {
          client: (Array.isArray(eventData.client) ? eventData.client : (eventData.client ? [eventData.client] : [])).map((id: string) => profileMap[id] || null).filter(Boolean),
          professional: (Array.isArray(eventData.professional) ? eventData.professional : (eventData.professional ? [eventData.professional] : [])).map((id: string) => profileMap[id] || null).filter(Boolean),
        }
      }

      setSelectedEvent(enriched as any)
      setDialogOpen(true)
    } catch (err) {
      logError('Error cargando evento:', err)
    }
  }

  const handleAdd = () => {
    if (isClient) return // No-op for clients (show 'Agendar cita' button without functionality)
    setClickedDateTime(null)
    setSelectedEvent(null)
    setDialogOpen(true)
  }

  const handleSave = () => {
    loadEvents()
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedProfessional('all')
  }

  const handleEventDrop = async (info: any) => {
    try {
      const eventId = info.event.id
      const newStart = info.event.start

      // Actualizar en Supabase using timezone-less local format to preserve wall-clock time
      const { error } = await supabase.from('events').update({ datetime: formatDateAsDbLocalString(newStart) }).eq('id', eventId)
      if (error) throw error

      // Recargar eventos
      loadEvents()
    } catch (err) {
      logError('Error moviendo evento:', err)
      info.revert() // Revertir si falla
    }
  }

  const handleEventResize = async (info: any) => {
    try {
      const eventId = info.event.id
      const newStart = info.event.start
      const newEnd = info.event.end

      // Calcular nueva duración en minutos
      const durationMs = newEnd.getTime() - newStart.getTime()
      const durationMin = Math.round(durationMs / (1000 * 60))

      // Actualizar en Supabase using timezone-less local format to preserve wall-clock time
      const { error } = await supabase.from('events').update({ datetime: formatDateAsDbLocalString(newStart), duration: durationMin }).eq('id', eventId)
      if (error) throw error

      // Recargar eventos
      loadEvents()
    } catch (err) {
      logError('Error redimensionando evento:', err)
      info.revert() // Revertir si falla
    }
  }

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
            <label htmlFor="show-my-events" className="text-sm font-medium cursor-pointer">Ver mis eventos</label>
            <label className="flex items-center cursor-pointer">
              <input
                id="show-my-events"
                type="checkbox"
                className="peer sr-only"
                checked={showMyEvents}
                onChange={(e) => setShowMyEvents(e.target.checked)}
              />
              <div className="h-5 w-9 rounded-full bg-muted relative peer-checked:bg-primary transition-colors">
                <div className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-background shadow transform transition-transform ${showMyEvents ? 'translate-x-4' : 'translate-x-0'}`} />
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
            <div className="flex items-center text-sm font-medium">Clases restantes: <span className="font-bold ml-1">{clientCredits ?? 0}</span>
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
              const openTime = company?.open_time || '08:00'
              const closeTime = company?.close_time || '20:00'

              return (
                <FullCalendarLazy
                  initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
                  headerToolbar={{
                    left: isMobile ? 'prev,next' : 'prev,next today',
                    center: 'title',
                    right: isMobile ? 'today' : 'dayGridMonth,timeGridWeek,timeGridDay'
                  }}
                  buttonText={{
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día'
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
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={true}
                  weekends={true}
                  eventDrop={handleEventDrop}
                  eventResize={handleEventResize}
                  titleFormat={isMobile ? { month: 'short', day: 'numeric' } : undefined}
                  dayHeaderFormat={isMobile ? { weekday: 'short', day: 'numeric' } : undefined}
                />
              )
            })()}
          </Suspense>
        </CardContent>
      </Card>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        onSave={handleSave}
        initialDateTime={clickedDateTime}
      />
    </div>
  )
}
