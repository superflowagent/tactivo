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
import pb from '@/lib/pocketbase'
import { error as logError } from '@/lib/logger'
import type { Event } from '@/types/event'
import type { Company } from '@/types/company'
import { EventDialog } from '@/components/eventos/EventDialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeForSearch } from '@/lib/utils'
import { getUserCardsByRole, getUserCardsByIds } from '@/lib/userCards'
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

  useEffect(() => {
    loadCompany()
    loadEvents()
    loadProfessionals()
    // If the logged-in user is a client, load their credits
    loadClientCredits()
  }, [companyId, user?.id, isClient])

  // Load the client's `class_credits` from the `users` collection (uses view rules)
  const loadClientCredits = async () => {
    if (!isClient || !user?.id) return

    try {
      const userRecord = await pb.collection('users').getOne<any>(user.id)
      setClientCredits(userRecord?.class_credits ?? 0)
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
      const records = await getUserCardsByRole(companyId, 'professional')
      setProfessionals(records)
    } catch (err) {
      logError('Error cargando profesionales desde user_cards:', err)
    }
  }

  const loadCompany = async () => {
    if (!companyId) return

    try {
      const record = await pb.collection('companies').getOne<Company>(companyId)
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

  const loadEvents = async () => {
    if (!companyId) return

    try {
      // Cargar eventos de la company actual con relaciones expandidas
      const records = await pb.collection('events').getFullList<Event>({
        expand: 'client,professional',
        sort: 'datetime',
        filter: `company = "${companyId}"`,
      })

      // Transformar eventos para FullCalendar
      const calendarEvents = records.map(event => {
        let title = ''
        let backgroundColor = ''
        let borderColor = ''

        // Obtener arrays expandidos (pueden venir de user_cards)
        const expandedClients = (event as any).expand?.client || []
        const expandedProfessionals = (event as any).expand?.professional || []

        // Construir strings con nombres para búsqueda (por ahora a partir de expand si existe)
        let clientNames = Array.isArray(expandedClients)
          ? expandedClients.map((c: any) => `${c.name} ${c.last_name}`).join(', ')
          : expandedClients ? `${expandedClients.name} ${expandedClients.last_name}` : ''
        const professionalNames = Array.isArray(expandedProfessionals)
          ? expandedProfessionals.map((p: any) => `${p.name} ${p.last_name}`).join(', ')
          : expandedProfessionals ? `${expandedProfessionals.name} ${expandedProfessionals.last_name}` : ''

        // Determinar título y color según tipo
        if (event.type === 'appointment') {
          // Obtener nombre del cliente (primero del array expandido si existe)
          const expandedClient = Array.isArray(expandedClients) ? expandedClients[0] : expandedClients
          title = expandedClient
            ? `${expandedClient.name} ${expandedClient.last_name}`
            : 'Cita'
          backgroundColor = 'hsl(var(--appointment-color))'
          borderColor = 'hsl(var(--appointment-color))'
        } else if (event.type === 'class') {
          title = 'Clase'
          backgroundColor = 'hsl(var(--class-color))'
          borderColor = 'hsl(var(--class-color))'
        } else if (event.type === 'vacation') {
          // Obtener nombres de todos los profesionales
          if (professionalNames) {
            title = professionalNames
          } else {
            title = 'Vacaciones'
          }
          backgroundColor = 'hsl(var(--vacation-color))'
          borderColor = 'hsl(var(--vacation-color))'
        }

        return {
          id: event.id,
          title,
          start: event.datetime,
          end: new Date(new Date(event.datetime).getTime() + event.duration * 60000).toISOString(),
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
          // Also include raw event record so we can augment clientNames afterwards if needed
          _rawEvent: event
        }
      })

      // If any events lack clientNames (expand missing), fetch user_cards by ids to build names
      const allClientIds = new Set<string>()
      calendarEvents.forEach(ce => {
        const ids = ce.extendedProps?.client || []
        if (Array.isArray(ids)) ids.forEach((id: string) => allClientIds.add(id))
      })

      if (allClientIds.size > 0) {
        try {
          const idsArray = Array.from(allClientIds)
          const cardsMap = await getUserCardsByIds(idsArray)
          // fill missing clientNames where necessary
          calendarEvents.forEach(ce => {
            if ((!ce.extendedProps?.clientNames || ce.extendedProps.clientNames === '') && Array.isArray(ce.extendedProps.client) && ce.extendedProps.client.length) {
              const names = ce.extendedProps.client.map((id: string) => {
                const c = cardsMap[id]
                return c ? `${c.name} ${c.last_name}` : null
              }).filter(Boolean).join(', ')

              if (names) {
                ce.extendedProps.clientNames = names
              }
            }
          })
        } catch (err) {
          logError('Error cargando user_cards para clientNames:', err)
        }
      }

      setEvents(calendarEvents)
      setFilteredEvents(calendarEvents)
      // Refresh client credits after loading events (in case they changed)
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
      // Cargar el evento completo desde PocketBase
      const eventData = await pb.collection('events').getOne<Event>(eventId, {
        expand: 'client,professional',
      })

      setSelectedEvent(eventData)
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

      // Actualizar en PocketBase
      await pb.collection('events').update(eventId, {
        datetime: newStart.toISOString(),
      })

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

      // Actualizar en PocketBase
      await pb.collection('events').update(eventId, {
        datetime: newStart.toISOString(),
        duration: durationMin,
      })

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
<<<<<<< HEAD
            <div className="text-sm font-medium">Clases restantes:
              <span className="ml-2 inline-flex items-center gap-1">
                <span className="font-bold">{clientCredits ?? 0}</span>
                {(clientCredits ?? 0) <= 0 && (
                  <AlertTriangle className="h-4 w-4 text-orange-600" role="img" aria-label="Créditos insuficientes" />
                )}
              </span>
=======
            <div className="flex items-center text-sm font-medium">Clases restantes: <span className="font-bold ml-1">{clientCredits ?? 0}</span>
              {(clientCredits ?? 0) <= 0 && (
                <span className="ml-2 inline-block" role="img" aria-label="Créditos insuficientes">
                  <AlertTriangle className="h-4 w-4 text-orange-600" aria-hidden="true" />
                </span>
              )}
>>>>>>> pre-migracion-supabase
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
            {company && (() => {
              // Calculate slot height to fit all schedule without scroll
              const openTime = company.open_time || '08:00'
              const closeTime = company.close_time || '20:00'

              // Parse hours and minutes
              const [openHour, openMin] = openTime.split(':').map(Number)
              const [closeHour, closeMin] = closeTime.split(':').map(Number)

              // Calculate total minutes in schedule
              const totalMinutes = (closeHour * 60 + closeMin) - (openHour * 60 + openMin)
              const numSlots = totalMinutes / 30 // 30-minute slots

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
