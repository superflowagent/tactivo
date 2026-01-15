import React from 'react';
import Iphone from '@/components/ui/Iphone';
import { Trash, Menu } from 'lucide-react';

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
        <div className="w-full h-full overflow-hidden flex items-center justify-center">

            <div className="px-3 py-2 flex items-center justify-center h-full overflow-hidden w-full">
                <Iphone className="w-[240px] h-[360px] max-w-full max-h-full shadow-lg">
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

                        <div className="mb-1">
                            <input
                                className="w-full rounded-lg border p-2 text-sm select-text"
                                placeholder="Buscar clientes..."
                                aria-label="Buscar clientes"
                                readOnly
                            />
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
                                        {clients.map((c) => (
                                            <div
                                                key={c.id}
                                                className={`flex items-center gap-3 px-2 py-1 hover:bg-muted/50 text-xs ${dragging ? 'cursor-grabbing' : 'hover:cursor-grab'}`}
                                            >
                                                <img src={c.photo} alt={c.name} className="w-7 aspect-square rounded-md object-cover" />

                                                <div className="w-[140px] flex-none">
                                                    <div className="font-medium truncate">{c.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                                                </div>

                                                <div className="w-24 text-left text-xs text-muted-foreground pl-1">{c.sport}</div>

                                                <div className="w-8 flex justify-end">
                                                    <button className="p-1 text-muted-foreground" aria-label="Eliminar">
                                                        <Trash className="h-4 w-4" />
              