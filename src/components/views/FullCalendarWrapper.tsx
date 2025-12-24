import React from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'

// Lightweight wrapper so calendar can be lazy-loaded as a separate chunk
export default function FullCalendarWrapper(props: any) {
    const { locale = esLocale, events, ...rest } = props

    return (
        <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={locale}
            events={events}
            {...rest}
        />
    )
}
