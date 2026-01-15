import React from 'react';

const WEEKDAYS = [
  { name: 'Lunes', value: 1 },
  { name: 'Martes', value: 2 },
  { name: 'Miércoles', value: 3 },
  { name: 'Jueves', value: 4 },
  { name: 'Viernes', value: 5 },
];

const sampleProfessionals = [
  { name: 'Alberto Mirapeix', photo: `${import.meta.env.BASE_URL}landing/professional1.jpg?v=2` },
  { name: 'Pedro Coba', photo: `${import.meta.env.BASE_URL}landing/professional2.jpg?v=2` },
  { name: 'Ana Muñoz', photo: `${import.meta.env.BASE_URL}landing/professional3.jpg?v=2` },
];

function Avatar({ name, src }: { name: string; src?: string | null }) {
  const firstName = String(name).split(' ')[0] || name;

  if (src) {
    return <img src={src} alt={firstName} className="w-7 h-7 rounded-md object-cover" loading="lazy" />;
  }

  const initials = firstName
    .split('')
    .slice(0, 2)
    .join('');

  return (
    <div className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-xs font-medium text-foreground">
      {initials}
    </div>
  );
}

export default function FeaturePreviewClases() {
  // Define how many demo slots each day should show (2..4)
  const counts = [2, 4, 3, 2, 4];

  const timeOptions = ['08:00', '10:00', '12:00', '16:00', '18:00', '19:30'];

  const makeSlotsForDay = (i: number) => {
    const cnt = counts[i];
    return Array.from({ length: cnt }).map((_, idx) => {
      const prof = sampleProfessionals[(i + idx) % sampleProfessionals.length];
      const time = timeOptions[(i + idx) % timeOptions.length];
      return {
        time,
        duration: `${60 + (idx % 2) * 30} min`,
        professional: prof.name,
        photo: prof.photo,
        clients: 1 + ((i + idx) % 3),
      };
    });
  };

  return (
    <div className="w-full rounded-lg border bg-background dark:bg-surface-900 shadow-sm transform-gpu transition-transform duration-200 ease-out hover:scale-[1.03] overflow-hidden relative h-full flex flex-col">
      <div className="p-2 border-b">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Plantilla de clases</h3>
          <span className="text-xs text-muted-foreground">Demo</span>
        </div>
      </div>

      <div className="p-3 flex-1">
        {/* Horizontal scroll area */}
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-2">
            {WEEKDAYS.map((d, i) => {
              const slots = makeSlotsForDay(i);
              return (
                <div key={d.value} className="flex-none w-44 min-h-[12rem] bg-muted/5 border rounded-md p-2 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">{d.name}</div>
                  </div>

                  <div className="space-y-2 mt-1">
                    {slots.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">Sin clases</div>
                    ) : (
                      slots.map((s, idx) => (
                        <div key={idx} className="bg-background rounded-md border shadow-sm p-2 text-sm cursor-default">
                          <div className="font-semibold">{s.time}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <div className="flex items-center gap-2">
                              <Avatar name={s.professional} src={s.photo} />
                              <span className="truncate">{s.professional}</span>
                            </div>
                            <div className="mt-1">⏱ {s.duration} · 👥 {s.clients}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
