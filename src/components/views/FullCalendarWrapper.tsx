import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

// Lightweight wrapper so calendar can be lazy-loaded as a separate chunk
// Forward the ref so parent components can access FullCalendar's getApi()
const FullCalendarWrapper = React.forwardRef(function FullCalendarWrapper(props: any, ref: any) {
  const { locale = esLocale, events, ...rest } = props;

  return (
    <FullCalendar
      ref={ref}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      locale={locale}
      events={events}
      {...rest}
    />
  );
});

export default FullCalendarWrapper;
