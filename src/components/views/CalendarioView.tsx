import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarPlus } from "lucide-react"
import pb from '@/lib/pocketbase'
import type { Event } from '@/types/event'
import { EventDialog } from '@/components/eventos/EventDialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuth } from '@/contexts/AuthContext'
import './calendario.css'

export function CalendarioView() {
  const { companyId } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [filteredEvents, setFilteredEvents] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [clickedDateTime, setClickedDateTime] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all')
  const [professionals, setProfessionals] = useState<any[]>([])
  const isMobile = useIsMobile()

  useEffect(() => {
    loadEvents()
    loadProfessionals()
  }, [companyId])

  useEffect(() => {
    filterEvents()
  }, [events, searchQuery, selectedProfessional])

  const loadProfessionals = async () => {
    if (!companyId) return

    try {
      const records = await pb.collection('users').getFullList({
        filter: `role="professional" && company="${companyId}"`,
        sort: 'name',
      })
      setProfessionals(records)
    } catch (error) {
      console.error('Error cargando profesionales:', error)
    }
  }

  const filterEvents = () => {
    let filtered = [...events]

    // Filtrar por búsqueda de texto
    if (searchQuery) {
      filtered = filtered.filter(event => {
        const query = searchQuery.toLowerCase()
        const titleMatch = event.title?.toLowerCase().includes(query)
        const notesMatch = event.extendedProps?.notes?.toLowerCase().includes(query)
        return titleMatch || notesMatch
      })
    }

    // Filtrar por profesional
    if (selectedProfessional !== 'all') {
      filtered = filtered.filter(event =>
        event.extendedProps?.professional?.includes(selectedProfessional)
      )
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

        // Determinar título y color según tipo
        if (event.type === 'appointment') {
          // Obtener nombre del cliente
          const expandedClient = (event as any).expand?.client?.[0]
          title = expandedClient
            ? `${expandedClient.name} ${expandedClient.last_name}`
            : 'Cita'
          backgroundColor = 'hsl(var(--chart-2))' // Verde/turquesa
          borderColor = 'hsl(var(--chart-2))'
        } else if (event.type === 'class') {
          title = 'Clase'
          backgroundColor = 'hsl(var(--chart-5))' // Naranja
          borderColor = 'hsl(var(--chart-5))'
        } else if (event.type === 'vacation') {
          // Obtener nombres de todos los profesionales
          const expandedProfessionals = (event as any).expand?.professional
          if (expandedProfessionals && expandedProfessionals.length > 0) {
            const names = expandedProfessionals.map((prof: any) =>
              `${prof.name} ${prof.last_name}`
            ).join(', ')
            title = names
          } else {
            title = 'Vacaciones'
          }
          backgroundColor = 'hsl(var(--muted-foreground))' // Gris
          borderColor = 'hsl(var(--muted-foreground))'
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
            professional: event.professional
          }
        }
      })

      setEvents(calendarEvents)
      setFilteredEvents(calendarEvents)
    } catch (error) {
      console.error('Error cargando eventos:', error)
    }
  }

  const handleDateClick = (arg: any) => {
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
    } catch (error) {
      console.error('Error cargando evento:', error)
    }
  }

  const handleAdd = () => {
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
    } catch (error) {
      console.error('Error moviendo evento:', error)
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
    } catch (error) {
      console.error('Error redimensionando evento:', error)
      info.revert() // Revertir si falla
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Botón crear - siempre arriba en móvil */}
      <Button onClick={handleAdd} className="w-full sm:hidden">
        <CalendarPlus className="mr-0 h-4 w-4" />
        Crear Evento
      </Button>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex w-full sm:w-auto gap-2">
          <Input
            placeholder="Buscar eventos..."
            className="flex-1 sm:max-w-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
            <SelectTrigger className="w-[140px] sm:w-[200px]">
              <SelectValue placeholder="Profesional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {professionals.map((prof) => (
                <SelectItem key={prof.id} value={prof.id}>
                  {prof.name} {prof.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(searchQuery || selectedProfessional !== 'all') && (
          <Button variant="outline" onClick={handleClearFilters} className="w-full sm:w-auto">
            Limpiar filtros
          </Button>
        )}
        <div className="hidden sm:block flex-1" />
        <Button onClick={handleAdd} className="hidden sm:flex">
          <CalendarPlus className="mr-0 h-4 w-4" />
          Crear Evento
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
            locale={esLocale}
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
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            allDaySlot={false}
            height={isMobile ? "calc(100vh - 340px)" : "calc(100vh - 240px)"}
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
