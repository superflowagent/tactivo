import React, { useState } from 'react';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';
import { Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const HOURS_START = 7.75; // 7:45
const HOURS_END = 12; // 12:00
const TOTAL_MINUTES = (HOURS_END - HOURS_START) * 60;

function parseHM(time: string) {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + mm;
}

// Note: PIXELS_PER_MIN and related layout sizes are now computed inside the component
// to allow responsive smaller heights on mobile devices.


export default function CalendarPreview() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState('all');

  // Responsive desired heights (desktop: 280, tablet: 200, small: 160)
  const getDesiredHeight = () => {
    if (typeof window === 'undefined') return 280;
    const w = window.innerWidth;
    if (w < 420) return 160;
    if (w < 640) return 200;
    return 280;
  };

  const [desiredHeight, setDesiredHeight] = useState<number>(getDesiredHeight);

  React.useEffect(() => {
    const onResize = () => setDesiredHeight(getDesiredHeight());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Compute layout values based on current desiredHeight
  const PIXELS_PER_MIN = Math.max(1, Math.floor(desiredHeight / TOTAL_MINUTES));
  const CONTAINER_HEIGHT = PIXELS_PER_MIN * TOTAL_MINUTES;
  const ROW_COUNT = Math.ceil(HOURS_END - HOURS_START);
  const HOUR_ROW_HEIGHT = PIXELS_PER_MIN * 60;

  const WeekEvent = ({ event }: { event: any }) => {
    const startMin = parseHM(event.start);
    const endMin = parseHM(event.end);
    const top = (startMin - HOURS_START * 60) * PIXELS_PER_MIN;
    const height = Math.max((endMin - startMin) * PIXELS_PER_MIN, 40);

    const words = String(event.title || '')
      .split(' ')
      .filter(Boolean);
    const hasSurname = words.length > 1;
    const firstPart = hasSurname ? words.slice(0, -1).join(' ') : event.title;
    const lastPart = hasSurname ? words.slice(-1).join(' ') : '';

    return (
      <div
        className="absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded-sm px-1 sm:px-2 py-1 text-white overflow-hidden flex flex-col items-start"
        style={{ top, height, backgroundColor: event.color }}
      >
        <div className="font-medium text-xs leading-tight text-left">{firstPart}</div>
        {hasSurname && <div className="font-medium text-xs leading-tight mt-0.5 text-left">{lastPart}</div>}

        {event.color === '#14B8A6' && (
          <span className="absolute bottom-0.5 right-0.5 w-4 h-4 flex items-center justify-center" aria-hidden>
            <img src="/WhatsApp_Logo.svg" alt="WhatsApp" className="w-3 h-3" />
          </span>
        )}
      </div>
    );
  };

  const professionals = [
    { id: 'all', name: 'Profesionales' },
    { id: 'victor', name: 'Víctor Romero' },
    { id: 'jorge', name: 'Jorge Polo' },
  ];

  // Example events (day: 0 = lunes, 1 = martes, ...)
  const events = [
    // Four example appointments with client names
    {
      day: 0,
      start: '09:00',
      end: '10:00',
      title: 'María López',
      color: '#14B8A6',
      professional: 'victor',
    },
    {
      day: 0,
      start: '10:30',
      end: '11:30',
      title: 'Gaspar Gutiérrez',
      color: '#14B8A6',
      professional: 'jorge',
    },
    {
      day: 0,
      start: '12:00',
      end: '13:00',
      title: 'Merche Campos',
      color: '#14B8A6',
      professional: 'victor',
    },
    {
      day: 1,
      start: '08:30',
      end: '10:00',
      title: 'Clase',
      color: '#FB923C',
      professional: 'jorge',
    },
    {
      day: 1,
      start: '10:30',
      end: '11:30',
      title: 'Marcos Rubio',
      color: '#14B8A6',
      professional: 'jorge',
    },
    {
      day: 2,
      start: '08:30',
      end: '10:00',
      title: 'Clase',
      color: '#FB923C',
      professional: 'victor',
    },
    {
      day: 2,
      start: '10:30',
      end: '11:30',
      title: 'Cristina Pardo',
      color: '#14B8A6',
      professional: 'victor',
    },
    {
      day: 3,
      start: '08:30',
      end: '10:00',
      title: 'Clase',
      color: '#FB923C',
      professional: 'jorge',
    },
    {
      day: 3,
      start: '12:00',
      end: '13:00',
      title: 'Clase',
      color: '#FB923C',
      professional: 'victor',
    },
    // moved Wed 14:00 -> 12:00 as requested
    {
      day: 2,
      start: '12:00',
      end: '13:00',
      title: 'Jose Pérez',
      color: '#14B8A6',
      professional: 'victor',
    },
    // Added per request: Friday (vie) events
    {
      day: 4,
      start: '08:00',
      end: '09:00',
      title: 'Pedro Coba',
      color: '#14B8A6',
      professional: 'victor',
    },
    {
      day: 4,
      start: '11:00',
      end: '12:00',
      title: 'Clase',
      color: '#FB923C',
      professional: 'jorge',
    },
  ];

  // Normalize string to remove accents/tildes
  const normalizeString = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Filter events based on search term (ignoring accents) and professional
  const filteredEvents = events.filter((event) => {
    const matchesSearch = normalizeString(event.title).includes(normalizeString(searchTerm));
    const matchesProfessional =
      selectedProfessional === 'all' || event.professional === selectedProfessional;
    return matchesSearch && matchesProfessional;
  });

  const days = ['lun', 'mar', 'mié', 'jue', 'vie'];

  return (
    <CardContainer>
      <CardBody className="bg-gray-50 relative group/card dark:bg-black border border-black/[0.06] w-full max-w-[520px] rounded-xl p-4">
        <div className="flex flex-col gap-3">
          <CardItem translateZ={20} className="w-full">
            <div className="flex items-center justify-start sm:justify-between">
              <div className="text-sm font-medium text-left">Calendario</div>
            </div>
          </CardItem>

          {/* Search bar and Professionals dropdown side by side */}
          <div className="flex gap-3">
            {/* Search bar */}
            <CardItem translateZ={30} className="flex-1 relative z-50">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar eventos"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </CardItem>

            {/* Professionals dropdown */}
            <CardItem translateZ={30} className="relative z-50">
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardItem>
          </div>

          <CardItem translateZ={40} className="w-full">
            <div className="rounded-md border bg-white overflow-hidden">
              <div className="flex border-b">
                <div className="w-10 sm:w-12" />
                {days.map((d) => (
                  <div key={d} className="flex-1 text-center text-xs font-medium py-1.5 sm:py-2">
                    {d}
                  </div>
                ))}
              </div>

              <div className="relative flex" style={{ minHeight: CONTAINER_HEIGHT + 'px' }}>
                {/* left times column */}
                <div className="w-12 border-r text-xs text-muted-foreground px-1">
                  {Array.from({ length: Math.floor(HOURS_END) - Math.floor(HOURS_START) + 1 }).map(
                    (_, i) => {
                      const hour = Math.floor(HOURS_START) + i;
                      return (
                        <div
                          key={hour}
                          style={{ height: HOUR_ROW_HEIGHT }}
                          className="flex items-start justify-end pr-1"
                        >
                          {hour}:00
                        </div>
                      );
                    }
                  )}
                </div>

                {/* day columns */}
                <div className="flex-1 grid grid-cols-5">
                  {days.map((d, di) => (
                    <div
                      key={d}
                      className="relative border-r"
                      style={{ minHeight: CONTAINER_HEIGHT + 'px' }}
                    >
                      {/* hourly grid lines (use HOUR_ROW_HEIGHT for consistent spacing) */}
                      {Array.from({ length: ROW_COUNT }).map((_, i) => (
                        <div
                          key={i}
                          style={{ height: HOUR_ROW_HEIGHT }}
                          className="border-b border-dashed border-muted/30"
                        />
                      ))}

                      {/* events for this day */}
                      {filteredEvents
                        .filter((e) => e.day === di)
                        .map((e, idx) => (
                          <WeekEvent key={idx} event={e} />
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
}
