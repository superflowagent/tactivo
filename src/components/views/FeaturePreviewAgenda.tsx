import React from 'react';
import { Button } from '@/components/ui/button';
import Confetti, { type ConfettiRef } from '@/components/ui/Confetti';
// Dropdown disabled in landing preview for performance - replaced with static text


const slots = [
    {
        time: 'Jueves 15 ene 2026, 8:00',
        duration: '60 min',
        name: 'Víctor Romero',
        photo: `${import.meta.env.BASE_URL}landing/professional1.jpg?v=2`,
    },
    {
        time: 'Jueves 15 ene 2026, 9:45',
        duration: '60 min',
        name: 'Jorge Polo',
        photo: `${import.meta.env.BASE_URL}landing/professional2.jpg?v=2`,
    },
    {
        time: 'Jueves 15 ene 2026, 16:00',
        duration: '60 min',
        name: 'Jorge Polo',
        photo: `${import.meta.env.BASE_URL}landing/professional2.jpg?v=2`,
    },
    {
        time: 'Jueves 15 ene 2026, 10:15',
        duration: '60 min',
        name: 'Víctor Romero',
        photo: `${import.meta.env.BASE_URL}landing/professional1.jpg?v=2`,
    },
];

function Avatar({ name, src }: { name: string; src?: string | null }) {
    const firstName = String(name).split(' ')[0] || name;

    if (src) {
        return <img src={src} alt={firstName} loading="eager" decoding="async" width={28} height={28} className="w-7 h-7 sm:w-8 sm:h-8 rounded-md object-cover" />;
    }

    const initials = firstName
        .split('')
        .slice(0, 2)
        .join('');

    return (
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted text-sm font-medium text-foreground">
            {initials}
        </div>
    );
}

export default function FeaturePreviewAgenda() {
    const confettiRef = React.useRef<ConfettiRef | null>(null);
    // Selection dropdown removed from landing preview to reduce weight; show all slots by default


    const parseSlotTime = (t: string) => {
        // Expected format: 'Jueves 15 ene 2026, 8:00' (Spanish month abbrev)
        try {
            const m = String(t).match(/(\d{1,2})\s+([a-zñ]+)\s+(\d{4}),?\s*(\d{1,2}:\d{2})$/i);
            if (!m) return Number.POSITIVE_INFINITY;
            const day = Number(m[1]);
            const monthAbbr = m[2].toLowerCase();
            const year = Number(m[3]);
            const timePart = m[4];
            const months: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
            const month = months[monthAbbr] ?? 0;
            const [hh, mm] = timePart.split(':').map(Number);
            const d = new Date(year, month, day, hh, mm);
            return d.getTime();
        } catch {
            return Number.POSITIVE_INFINITY;
        }
    };

    const filteredSlots = React.useMemo(() => {
        // Show all demo slots in the landing preview (no interactive selection)
        return slots.slice().sort((a, b) => parseSlotTime(a.time) - parseSlotTime(b.time));
    }, []);

    return (
        <div className="w-full rounded-lg border bg-background dark:bg-surface-900 shadow-sm transform-gpu transition-transform duration-200 ease-out sm:hover:scale-[1.03] overflow-hidden relative h-full flex flex-col">
            <Confetti ref={confettiRef} className="absolute inset-0 z-10 pointer-events-none" />
            <div className="p-2 border-b">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Agendar cita</h3>


                </div>

                <div className="mt-0.5">
                    <span className="text-xs text-muted-foreground">Huecos disponibles en Zenith Fisioterapia</span>
                </div>
            </div>

            <div className="p-1 max-h-[18rem] overflow-y-auto">
                <div className="flex flex-col divide-y">
                    {filteredSlots.slice(0, 4).map((s, i) => {
                        const hour = String(s.time).match(/(\d{1,2}:\d{2})$/)?.[1] ?? s.time;
                        const dateMatch = String(s.time).match(/^([^\d,]+)\s+(\d{1,2})/);
                        const dateLabel = dateMatch ? `${dateMatch[1].trim()} ${dateMatch[2]}` : '';

                        return (
                            <div key={i} className="py-2 px-2 sm:px-4 grid grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-1 sm:gap-4 border-b transition-colors hover:bg-muted/50 cursor-default">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{hour}</div>
                                    <div className="text-xs text-muted-foreground truncate">{dateLabel}</div>
                                    <div className="text-xs text-muted-foreground truncate">{s.duration}</div>
                                </div>

                                <div className="min-w-0">
                                    <div className="px-2 py-0.5 rounded-md bg-muted/20 text-muted-foreground flex items-center gap-2">
                                        <Avatar name={s.name} src={s.photo} />
                                        <span className="text-sm text-black">{String(s.name).split(' ')[0]}</span>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            const btn = e.currentTarget as HTMLButtonElement;

                                            // Immediate tactile feedback: quick scale (no long transition)
                                            btn.style.transition = 'transform 80ms linear';
                                            btn.style.transform = 'scale(0.96)';

                                            // Allow the browser to paint the pressed state, then revert and trigger confetti
                                            requestAnimationFrame(() => {
                                                requestAnimationFrame(() => {
                                                    btn.style.transform = '';

                                                    const cx = e.clientX;
                                                    const cy = e.clientY;

                                                    // Schedule confetti on the next frame so the UI update isn't blocked
                                                    requestAnimationFrame(() => {
                                                        confettiRef.current?.fire({ clientX: cx, clientY: cy, count: 8 });
                                                    });
                                                });
                                            });
                                        }}
                                    >
                                        Reservar
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
