import React from 'react';
import { Button } from '@/components/ui/button';
import Confetti, { type ConfettiRef } from '@/components/ui/Confetti';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';

const slots = [
    {
        time: 'Jueves 15 ene 2026, 8:00',
        duration: 'Duración: 60 min',
        name: 'Víctor Romero',
        photo: '/landing/professional1.jpg',
    },

    {
        time: 'Jueves 15 ene 2026, 9:45',
        duration: 'Duración: 60 min',
        name: 'Jorge Polo',
        photo: '/landing/professional2.jpg',
    },
    {
        time: 'Jueves 15 ene 2026, 16:00',
        duration: 'Duración: 60 min',
        name: 'Jorge Polo',
        photo: '/landing/professional2.jpg',
    },
    {
        time: 'Jueves 15 ene 2026, 10:15',
        duration: 'Duración: 60 min',
        name: 'Víctor Romero',
        photo: '/landing/professional1.jpg',
    },
    {
        time: 'Viernes 16 ene 2026, 10:15',
        duration: 'Duración: 60 min',
        name: 'Jorge Polo',
        photo: '/landing/professional2.jpg',
    },
    {
        time: 'Viernes 16 ene 2026, 10:30',
        duration: 'Duración: 60 min',
        name: 'Víctor Romero',
        photo: '/landing/professional1.jpg',
    },
];

function Avatar({ name, src }: { name: string; src?: string | null }) {
    const firstName = String(name).split(' ')[0] || name;

    if (src) {
        return <img src={src} alt={firstName} className="w-8 h-8 rounded-md object-cover" loading="lazy" />;
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
    const [selected, setSelected] = React.useState('all');
    const professionals = [
        { id: 'all', name: 'Todos los profesionales' },
        { id: 'victor', name: 'Víctor Romero' },
        { id: 'jorge', name: 'Jorge Polo' },
    ];

    const filteredSlots = React.useMemo(() => {
        if (selected === 'all') return slots;
        if (selected === 'victor') return slots.filter((s) => s.name.includes('Víctor'));
        if (selected === 'jorge') return slots.filter((s) => s.name.includes('Jorge'));
        return slots;
    }, [selected]);

    return (
        <div className="w-full rounded-lg border bg-background dark:bg-surface-900 shadow-sm transform-gpu transition-transform duration-200 ease-out hover:scale-[1.03] overflow-hidden relative">
            <Confetti ref={confettiRef} className="absolute inset-0 z-10 pointer-events-none" />
            <div className="p-2 border-b">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Agendar cita</h3>

                    <div className="w-56">
                        <Select value={selected} onValueChange={(v) => setSelected(v)}>
                            <SelectTrigger className="w-full text-sm" aria-label="Seleccionar profesional">
                                <SelectValue placeholder="Todos los profesionales" />
                            </SelectTrigger>

                            <SelectContent className="w-56">
                                {professionals.map((p) => (
                                    <SelectItem key={p.id} value={p.id} className="text-sm">
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="mt-0.5">
                    <span className="text-xs text-muted-foreground">Huecos disponibles en Zenith Fisioterapia</span>
                </div>
            </div>

            <div className="p-1 max-h-[18rem] overflow-y-auto">
                <div className="flex flex-col divide-y">
                    {filteredSlots.map((s, i) => {
                        const hour = String(s.time).match(/(\d{1,2}:\d{2})$/)?.[1] ?? s.time;
                        const dateMatch = String(s.time).match(/^([^\d,]+)\s+(\d{1,2})/);
                        const dateLabel = dateMatch ? `${dateMatch[1].trim()} ${dateMatch[2]}` : '';

                        return (
                            <div key={i} className="py-2 px-3 sm:px-4 grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b transition-colors hover:bg-muted/50 cursor-default">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{hour}</div>
                                    <div className="text-xs text-muted-foreground truncate">{dateLabel}</div>
                                    <div className="text-xs text-muted-foreground truncate">{s.duration}</div>
                                </div>

                                <div className="min-w-0">
                                    <div className="px-2 py-0.5 rounded-md bg-muted/20 text-muted-foreground flex items-center gap-2">
                                        <Avatar name={s.name} src={s.photo} />
                                        <span className="text-sm">{String(s.name).split(' ')[0]}</span>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            const btn = e.currentTarget as HTMLElement;
                                            const r = btn.getBoundingClientRect();
                                            const cx = r.left + r.width / 2;
                                            const cy = r.top + r.height / 2;
                                            confettiRef.current?.fire({ clientX: cx, clientY: cy, count: 12 });
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
