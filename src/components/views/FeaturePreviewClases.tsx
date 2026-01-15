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
        return <img src={src} alt={firstName} loading="eager" decoding="async" width={24} height={24} className="w-6 h-6 rounded-md object-cover" />;
    }

    const initials = firstName
        .split('')
        .slice(0, 2)
        .join('');

    return (
        <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-muted text-xs font-medium text-foreground">
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
                clients: 1 + ((i + idx) % 4),
            };
        }).filter((s) => s.professional !== 'Ana Muñoz');
    };

    // Drag-to-scroll refs and state (copied from FeaturePreviewMultidispositivo)
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const isDown = React.useRef(false);
    const startX = React.useRef(0);
    const scrollLeft = React.useRef(0);
    const lastX = React.useRef(0);
    const lastTime = React.useRef(0);
    const velocity = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);
    const [dragging, setDragging] = React.useState(false);

    React.useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
        const el = scrollRef.current;
        if (!el) return;
        isDown.current = true;
        setDragging(true);
        el.setPointerCapture(e.pointerId);
        startX.current = e.clientX;
        scrollLeft.current = el.scrollLeft;
        lastX.current = e.clientX;
        lastTime.current = performance.now();
        velocity.current = 0;
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const el = scrollRef.current;
        if (!el || !isDown.current) return;
        e.preventDefault();
        const dx = e.clientX - startX.current;
        el.scrollLeft = scrollLeft.current - dx;

        // velocity calculation
        const now = performance.now();
        const dt = now - lastTime.current || 16;
        velocity.current = (e.clientX - lastX.current) / dt;
        lastX.current = e.clientX;
        lastTime.current = now;
    };

    const startMomentum = () => {
        const el = scrollRef.current;
        if (!el) return;
        let v = velocity.current * 16 * 2; // scale for feel

        const step = () => {
            v *= 0.95; // decay
            if (Math.abs(v) < 0.1) {
                rafRef.current = null;
                return;
            }
            el.scrollLeft -= v;
            rafRef.current = requestAnimationFrame(step);
        };

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(step);
    };

    const endDrag = (e?: React.PointerEvent, immediate = false) => {
        const el = scrollRef.current;
        if (!el) return;
        isDown.current = false;
        setDragging(false);

        if (e) {
            try {
                el.releasePointerCapture(e.pointerId);
            } catch (err) {
                // ignore
            }
        }

        if (immediate) {
            // stop any ongoing momentum and reset velocity immediately
            velocity.current = 0;
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }

        startMomentum();
    };

    return (
        <div className="w-full rounded-lg border bg-background dark:bg-surface-900 shadow-sm transform-gpu transition-transform duration-200 ease-out hover:scale-[1.03] overflow-hidden relative h-full flex flex-col">
            <div className="p-2 border-b">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Plantilla de clases</h3>
                </div>
            </div>

            <div className="p-3 flex-1">
                {/* Horizontal scroll area with drag-to-scroll */}
                <div
                    ref={scrollRef}
                    className={`overflow-x-auto hide-scrollbar ${dragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
                    style={{ touchAction: 'pan-x' }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={(e) => endDrag(e)}
                    onPointerCancel={(e) => endDrag(e, true)}
                    onPointerLeave={(e) => endDrag(e, true)}
                >
                    <div className="flex gap-2 pb-2">
                        {WEEKDAYS.map((d, i) => {
                            const slots = makeSlotsForDay(i);
                            return (
                                <div key={d.value} className="flex-none w-36 min-h-[12rem] bg-muted/5 border rounded-md p-1 flex flex-col">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold">{d.name}</div>
                                    </div>

                                    <div className="space-y-2 mt-1">
                                        {slots.length === 0 ? (
                                            <div className="text-sm text-muted-foreground text-center py-4">Sin clases</div>
                                        ) : (
                                            slots.map((s, idx) => (
                                                <div key={idx} className="bg-background rounded-md border shadow-sm p-1 text-sm cursor-default">
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
