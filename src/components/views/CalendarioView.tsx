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
import type { Cliente } from '@/types/cliente'
import { EventDialog } from '@/components/eventos/EventDialog'
import './calendario.css'

export function CalendarioView() {
  const [events, setEvents] = useState<any[]>([])
  const [filteredEvents, setFilteredEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [clickedDateTime, setClickedDateTime] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all')
  const [professionals, setProfessionals] = useState<any[]>([])

  useEffect(() => {
    loadEvents()
    loadProfessionals()
  }, [])

  useEffect(() => {
    filterEvents()
  }, [events, searchQuery, selectedProfessional])

  const loadProfessionals = async () => {
    try {
      const records = await pb.collection('users').getFullList({
        filter: 'role="professional"',
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
    try {
      setLoading(true)

      // Autenticar si es necesario
      try {
        await pb.admins.authWithPassword('superflow.agent@gmail.com', 'Superflow25')
      } catch (authErr) {
        console.log('Auth error (ignorado si ya está autenticado):', authErr)
      }

      // Cargar eventos con relaciones expandidas
      const records = await pb.collection('events').getFullList<Event>({
        expand: 'client,professional',
        sort: 'datetime',
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
          backgroundColor = 'hsl(173, 58%, 39%)' // Verde/turquesa
          borderColor = 'hsl(173, 58%, 39%)'
        } else if (event.type === 'class') {
          title = 'Clase'
          backgroundColor = 'hsl(27, 87%, 67%)' // Naranja
          borderColor = 'hsl(27, 87%, 67%)'
        } else if (event.type === 'vacation') {
          // Obtener nombre del profesional
          const expandedProfessional = (event as any).expand?.professional?.[0]
          title = expandedProfessional
            ? `${expandedProfessional.name} ${expandedProfessional.last_name}`
            : 'Vacaciones'
          backgroundColor = 'hsl(215, 20%, 65%)' // Gris muted
          borderColor = 'hsl(215, 20%, 65%)'
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
    } finally {
      setLoading(false)
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
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar eventos..."
          className="max-w-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Profesional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los profesionales</SelectItem>
            {professionals.map((prof) => (
              <SelectItem key={prof.id} value={prof.id}>
                {prof.name} {prof.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchQuery || selectedProfessional !== 'all') && (
          <Button variant="outline" onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
        )}
        <div className="flex-1" />
        <Button onClick={handleAdd}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Crear Evento
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale={esLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
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
            height="calc(100vh - 280px)"
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
