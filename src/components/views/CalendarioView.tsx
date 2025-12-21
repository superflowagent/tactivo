import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import './calendario.css'

export function CalendarioView() {
  const events = [
    {
      id: '1',
      title: 'Cita con María García',
      start: new Date().toISOString().split('T')[0] + 'T10:00:00',
      end: new Date().toISOString().split('T')[0] + 'T11:00:00',
    },
    {
      id: '2',
      title: 'Cita con Juan Martínez',
      start: new Date().toISOString().split('T')[0] + 'T14:30:00',
      end: new Date().toISOString().split('T')[0] + 'T15:30:00',
    },
  ]

  const handleDateClick = (arg: any) => {
    console.log('Fecha clickeada:', arg.dateStr)
  }

  const handleEventClick = (clickInfo: any) => {
    console.log('Evento clickeado:', clickInfo.event.title)
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Calendario de Citas</CardTitle>
        </CardHeader>
        <CardContent>
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
            height="auto"
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
          />
        </CardContent>
      </Card>
    </div>
  )
}
