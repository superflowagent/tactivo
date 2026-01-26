import React from 'react';
import Iphone from '@/components/ui/Iphone';
import { Trash, Menu, Calendar, Users, ListChecks, Dumbbell, Settings } from 'lucide-react';
import Confetti, { type ConfettiRef } from '@/components/ui/Confetti';
import { normalizeForSearch } from '@/lib/stringUtils';

const clients = [
    { id: '1', name: 'Alex Soler', dni: '123123123', phone: '123123123', email: 'alejandro@tactivo.es', sport: 'Balonmano', classes: 24, photo: `${import.meta.env.BASE_URL}landing/client1.jpg?v=2` },
    { id: '2', name: 'Nacho Rodrigo', dni: '123123123', phone: '123123123', email: 'nacho@tactivo.es', sport: 'Tenis', classes: 13, photo: `${import.meta.env.BASE_URL}landing/client2.jpg?v=2` },
    { id: '3', name: 'María López', dni: '987654321', phone: '987654321', email: 'maria@tactivo.es', sport: 'Yoga', classes: 8, photo: `${import.meta.env.BASE_URL}landing/client3.jpg?v=2` },
    { id: '4', name: 'Lucía García', dni: '456789123', phone: '456789123', email: 'lucia@tactivo.es', sport: 'Pilates', classes: 5, photo: `${import.meta.env.BASE_URL}landing/client4.jpg?v=2` },
    { id: '5', name: 'Carlos Méndez', dni: '321987654', phone: '321987654', email: 'carlos@tactivo.es', sport: 'Gimnasio', classes: 12, photo: `${import.meta.env.BASE_URL}landing/client5.jpg?v=2` },
    { id: '6', name: 'Clara Fernández', dni: '654321987', phone: '654321987', email: 'clara@tactivo.es', sport: 'Running', classes: 4, photo: `${import.meta.env.BASE_URL}landing/client6.jpg?v=2` },
    { id: '7', name: 'Miguel Álvarez', dni: '852741963', phone: '852741963', email: 'miguel@tactivo.es', sport: 'Crossfit', classes: 18, photo: `${import.meta.env.BASE_URL}landing/client7.jpg?v=2` },
];

export default function FeaturePreviewMultidispositivo() {
    // Search state
    const [searchQuery, setSearchQuery] = React.useState('');
    // Unique id to avoid duplicate id issues when component is rendered multiple times
    const uid = React.useId();

    // Confetti ref for delete action
    const confettiRef = React.useRef<ConfettiRef | null>(null);
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    return (
        <Iphone className="w-[260px] h-[520px] my-8 max-w-full max-h-full shadow-md transform-gpu transition-transform duration-150 ease-out sm:hover:scale-[1.04]">
            <div className="relative h-full flex flex-col min-h-0">
                <Confetti ref={confettiRef} className="absolute inset-0 z-50 pointer-events-none" />

                <div className="pl-2 pr-2 h-full overflow-hidden bg-white select-none">
                    <div className="mb-2 relative pt-2">
                        <button aria-label="Abrir menú" onClick={() => setSidebarOpen(true)} className="absolute left-0 top-3 p-0.5 rounded-md text-muted-foreground hover:bg-muted/20">
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
                            id={`${uid}-fp-search`}
                            name={`${uid}-fp-search`}
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

                    <div className="mb-2 overflow-x-hidden overflow-y-hidden">
                        <div className="min-w-0">
                            <div className="flex items-center gap-0 pl-2 pr-2 py-1 text-xs text-muted-foreground font-semibold">
                                <div className="w-7 mr-2">Foto</div>
                                <div className="w-[56px] flex-none">Nombre</div>
                                <div className="flex-1 text-left">Deporte</div>
                                <div className="flex-none w-5" />
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
                                                    const sport = normalizeForSearch(String(c.sport || ''));
                                                    return name.includes(q) || sport.includes(q);
                                                });

                                        return filtered.map((c) => (
                                            <div
                                                key={c.id}
                                                className="flex items-center gap-0 pl-2 pr-2 py-1 text-xs"
                                            >
                                                {(() => {
                                                    const base = String(c.photo).replace(/\?.*$/, '').replace(/\.(jpe?g|png)$/i, '');
                                                    return (
                                                        <picture>
                                                            <source type="image/avif" srcSet={`${base}-320.avif 320w, ${base}-640.avif 640w, ${base}-1200.avif 1200w`} />
                                                            <img src={c.photo} alt={c.name} loading="eager" decoding="async" width={28} height={28} className="w-7 aspect-square rounded-md object-cover mr-2" />
                                                        </picture>
                                                    );
                                                })()}

                                                <div className="w-[56px] flex-none">
                                                    <div className="font-medium truncate">{String(c.name || '').split(' ')[0]}</div>
                                                </div>

                                                <div className="flex-1 text-left text-xs text-muted-foreground pr-1 truncate">{c.sport}</div>

                                                <div className="flex-none w-5 flex justify-end">
                                                    <button
                                                        className="p-1 text-muted-foreground"
                                                        aria-label="Eliminar"
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
                                                            } catch {
                                                                // ignore confetti errors
                                                            }
                                                        }}
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ));
                                    }, [searchQuery])}                                    </div>
                            </div>
                        </div>
                    </div>

                    {/* Inline sidebar inside the phone preview */}
                    <div className={`absolute inset-y-0 left-0 z-40 w-[128px] bg-sidebar text-sidebar-foreground transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} role="dialog" aria-modal="true">
                        <div className="flex h-full flex-col">
                            <div className="p-3 border-b flex items-center gap-2">
                                <span
                                    className="inline-block text-base font-semibold"
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
                            <div className="p-2 flex flex-col gap-1">
                                <button onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                                    <Calendar className="h-4 w-4" /> Calendario
                                </button>
                                <button onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                                    <Users className="h-4 w-4" /> Clientes
                                </button>
                                <button onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                                    <ListChecks className="h-4 w-4" /> Clases
                                </button>
                                <button onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                                    <Dumbbell className="h-4 w-4" /> Ejercicios
                                </button>
                            </div>
                            <div className="mt-auto p-2 border-t">
                                <button onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                                    <Settings className="h-4 w-4" /> Ajustes
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* overlay confined to the phone preview */}
                    <div className={`absolute inset-0 z-30 bg-black/30 transition-opacity ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)} />
                </div>
            </div>
        </Iphone>
    );
}
