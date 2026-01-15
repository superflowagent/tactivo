import React from 'react';

const exercisesA = [
  { name: 'Sentadilla búlgara', tags: ['Pesa', 'Tobillo'], img: `${import.meta.env.BASE_URL}landing/professional1.jpg?v=2` },
  { name: 'Fondos', tags: ['Goma'], img: `${import.meta.env.BASE_URL}landing/professional2.jpg?v=2` },
  { name: 'Dominadas', tags: ['Goma'], img: `${import.meta.env.BASE_URL}landing/professional3.jpg?v=2` },
];

const exercisesB = [
  { name: 'Plancha lateral', tags: ['Isométrico'], img: `${import.meta.env.BASE_URL}landing/client1.jpg?v=1` },
  { name: 'Abdominales', tags: ['Piso'], img: `${import.meta.env.BASE_URL}landing/client2.jpg?v=1` },
  { name: 'Fondos con peso', tags: ['Peso'], img: `${import.meta.env.BASE_URL}landing/client3.jpg?v=1` },
];

export default function FeaturePreviewProgramas() {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const isDown = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const latestDx = React.useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDown.current = true;
    el.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    scrollLeft.current = el.scrollLeft;
    latestDx.current = 0;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el || !isDown.current) return;
    e.preventDefault();
    latestDx.current = e.clientX - startX.current;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el2 = scrollRef.current;
        if (!el2) return;
        el2.scrollLeft = scrollLeft.current - latestDx.current;
      });
    }
  };

  const endDrag = (e?: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDown.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Persist the last scrollLeft snapshot
    scrollLeft.current = el.scrollLeft;
    if (e) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
      }
    }
  };

  return (
    <div className="w-full rounded-lg border bg-background dark:bg-surface-900 shadow-sm transform-gpu transition-transform duration-200 ease-out hover:scale-[1.03] overflow-hidden relative h-full flex flex-col">
      <div className="p-2 border-b">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Programas de ejercicios</h3>
        </div>
      </div>

      <div className="p-3 flex-1">
        <div
          ref={scrollRef}
          className={`overflow-x-auto hide-scrollbar cursor-grab select-none`}
          style={{ touchAction: 'pan-x' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e)}
          onPointerCancel={(e) => endDrag(e)}
          onPointerLeave={(e) => endDrag(e)}
        >
          <div className="flex gap-4 pb-2">
            {[{ name: 'Día A', items: exercisesA }, { name: 'Día B', items: exercisesB }].map((d) => (
              <div key={d.name} className="flex-none w-[28rem] min-h-[12rem] bg-muted/5 border rounded-md px-3 py-2 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">{d.name}</div>
                </div>

                <div className="space-y-2 mt-1 flex-1">
                  {d.items.map((ex, i) => (
                    <div key={i} className="bg-background rounded-md border shadow-sm p-2 text-sm cursor-default flex gap-3">
                      <div className="w-20 h-14 rounded-md overflow-hidden bg-slate-100 flex-none">
                        <img src={ex.img} alt={ex.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold line-clamp-2">{ex.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
                          {ex.tags.map((t, idx) => (
                            <span key={idx} className="bg-muted/10 rounded px-2 py-0.5">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Spacer card to resemble add placeholder */}
            <div className="flex-none w-[14rem] min-h-[12rem] flex items-center justify-center">
              <div className="w-[10rem] h-[10rem] rounded-md bg-slate-100 border flex items-center justify-center text-muted-foreground">
                + Añadir
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
