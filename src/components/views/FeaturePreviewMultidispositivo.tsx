import React from 'react';
import Iphone from '@/components/ui/Iphone';
import { Trash, Menu } from 'lucide-react';
import Confetti, { type ConfettiRef } from '@/components/ui/Confetti';
import { normalizeForSearch } from '@/lib/stringUtils';

const clients = [
    { id: '1', name: 'Alejandro Soler', dni: '123123123', phone: '123123123', email: 'alejandro@tactivo.es', sport: 'Balonmano', classes: 24, photo: `${import.meta.env.BASE_URL}landing/client1.jpg?v=2` },
    { id: '2', name: 'Nacho Rodrigo', dni: '123123123', phone: '123123123', email: 'nacho@tactivo.es', sport: 'Tenis', classes: 13, photo: `${import.meta.env.BASE_URL}landing/client2.jpg?v=2` },
    { id: '3', name: 'María López', dni: '987654321', phone: '987654321', email: 'maria@tactivo.es', sport: 'Yoga', classes: 8, photo: `${import.meta.env.BASE_URL}landing/client3.jpg?v=2` },
    { id: '4', name: 'Carlos Méndez', dni: '456789123', phone: '456789123', email: 'carlos@tactivo.es', sport: 'Pilates', classes: 5, photo: `${import.meta.env.BASE_URL}landing/client4.jpg?v=2` },
    { id: '5', name: 'Lucía García', dni: '321987654', phone: '321987654', email: 'lucia@tactivo.es', sport: 'Gimnasio', classes: 12, photo: `${import.meta.env.BASE_URL}landing/client5.jpg?v=2` },
];

export default function FeaturePreviewMultidispositivo() {
    // Refs and state for drag-to-scroll with inertia
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const isDown = React.useRef(false);
    const startX = React.useRef(0);
    const scrollLeft = React.useRef(0);
    const lastX = React.useRef(0);
    const lastTime = React.useRef(0);
    const velocity = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);
    const [dragging, setDragging] = React.useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = React.useState('');

    // Confetti ref for delete action
    const confettiRef = React.useRef<ConfettiRef | null>(null);

    React.useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
        const el = scrollRef.current;
        if (!el) return;

        // Do not start a drag if the initial target is an interactive element
        const target = e.target as HTMLElement | null;
        if (target && target.closest && target.closest('button, a, input, textarea, select, label, [role="button"]')) {
            return;
        }

        isDown.current = true;
        setDragging(true);
        try {
            el.setPointerCapture(e.pointerId);
        } catch (err) {
            // ignore setPointerCapture failures
        }
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
        <div className="w-full h-full overflow-hidden flex items-center justify-center">

            <div className="px-3 py-2 flex items-center justify-center h-full overflow-hidden w-full transform-gpu transition-transform duration-200 ease-out hover:scale-[1.03]">
                <Iphone className="w-[240px] h-[360px] max-w-full max-h-full shadow-lg">
                    <div className="relative h-full">
                        <Confetti ref={confettiRef} className="absolute inset-0 z-50 pointer-events-none" />

                        <div className="p-2 h-full overflow-hidden bg-white select-none">
                            <div className="mb-2 relative">
                                <button aria-label="Abrir menú" className="absolute left-0 top-1.5 p-0.5 rounded-md text-muted-foreground hover:bg-muted/20">
                                    <Menu className="h-5 w-5" />
                                </button>

                                <div className="flex items-center justify-center">
                                    <span
                                        className="inline-block text-lg font-extrabold"
                                        style={{
                                            backgroundImage: 'var(--primary-gradient)',
                                            WebkitBackgroundClip: 'text',
                                            backgroundClip: 'text',
                                            color: 'transparent',
                                            WebkitTextFillColor: 'transparent',
                                            display: 'inline-block',
                                        }}
                                    >
                                        Tactivo
                                    </span>
                                </div>
                            </div>

                            <div className="mb-1 flex items-center gap-2">
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar cliente..."
                                    className="w-full rounded-lg border p-2 text-sm select-text focus:outline-none focus:ring-0 focus:border-border"
                                />

                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        aria-label="Limpiar búsqueda"
                                        className="text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>

                            <div
                                ref={scrollRef}
                                className={`mb-2 overflow-x-auto overflow-y-hidden hide-scrollbar ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                style={{ touchAction: 'pan-x' }}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={(e) => endDrag(e)}
                                onPointerCancel={(e) => endDrag(e, true)}
                                onPointerLeave={(e) => endDrag(e, true)}
                            >
                                <div className="min-w-[320px]">
                                    <div className="flex items-center gap-3 px-2 py-1 text-xs text-muted-foreground font-semibold">
                                        <div className="w-7">Foto</div>
                                        <div className="w-[140px] flex-none">Nombre</div>
                                        <div className="w-24 text-left pl-1">Deporte</div>
                                        <div className="w-8" />
                                    </div>

                                    <div className="rounded-md bg-background">
                                        <div className="divide-y">
                                            {React.useMemo(() => {
                                                const q = normalizeForSearch(searchQuery.trim());
                                                const filtered =
                                                    q === ''
                                                        ? clients
                                                        : clients.filter((c) => {
                                                            const name = normalizeForSearch(String(c.name || ''));
                                                            const email = normalizeForSearch(String(c.email || ''));
                                                            const sport = normalizeForSearch(String(c.sport || ''));
                                                            return name.includes(q) || email.includes(q) || sport.includes(q);
                                                        });

                                                return filtered.map((c) => (
                                                    <div
                                                        key={c.id}
                                                        className={`flex items-center gap-3 px-2 py-1 hover:bg-muted/50 text-xs ${dragging ? 'cursor-grabbing' : 'hover:cursor-grab'}`}
                                                    >
                                                        <img src={c.photo} alt={c.name} loading="eager" decoding="async" width={28} height={28} className="w-7 aspect-square rounded-md object-cover" />

                                                        <div className="w-[140px] flex-none">
                                                            <div className="font-medium truncate">{c.name}</div>
                                                            <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                                                        </div>

                                                        <div className="w-24 text-left text-xs text-muted-foreground pl-1">{c.sport}</div>

                                                        <div className="w-8 flex justify-end">
                                                            <button
                                                                className="p-1 text-muted-foreground hover:text-destructive transition-transform"
                                                                aria-label="Eliminar"
                                                                onPointerDown={() => { }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();

                                                                    const btn = e.currentTarget as HTMLElement;
                                                                    // visual feedback
                                                                    btn.classList.add('scale-105');
                                                                    setTimeout(() => btn.classList.remove('scale-105'), 260);

                                                                    // Use mouse event coordinates to avoid layout read (getBoundingClientRect)
                                                                    const nativeEvent = e as React.MouseEvent;
                                                                    const cx = nativeEvent.clientX;
                                                                    const cy = nativeEvent.clientY;

                                                                    try {
                                                                        if (confettiRef.current) {
                                                                            confettiRef.current.fire({ clientX: cx, clientY: cy, count: 12 });
                                                                        }
                                                                    } catch (err) {
                                                                        // ignore confetti errors
                                                                    }
                                                                }}
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ));
                                            }, [searchQuery, dragging])}                                    </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </Iphone>
            </div>
        </div>
    );
}
