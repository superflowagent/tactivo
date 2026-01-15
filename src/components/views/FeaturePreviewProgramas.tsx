import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

const exercisesA = [
    { name: 'Sentadilla búlgara', tags: ['Pesa', 'Tobillo'], video: `${import.meta.env.BASE_URL}landing/exercises/alante-rezo.mp4` },
    { name: 'Fondos', tags: ['Goma'], video: `${import.meta.env.BASE_URL}landing/exercises/elevacion-en-paredmp4.mp4` },
    { name: 'Dominadas', tags: ['Goma'], video: `${import.meta.env.BASE_URL}landing/exercises/escápulas.mp4` },
];

const exercisesB = [
    { name: 'Plancha lateral', tags: ['Isométrico'], video: `${import.meta.env.BASE_URL}landing/exercises/rotacio-lateral.mp4` },
    { name: 'Abdominales', tags: ['Piso'], video: `${import.meta.env.BASE_URL}landing/exercises/rotacion-externa.mp4` },
    { name: 'Fondos con peso', tags: ['Peso'], video: `${import.meta.env.BASE_URL}landing/exercises/vuelta-al-mundo.mp4` },
];

export default function FeaturePreviewProgramas() {
    // Small reusable hook-like handlers for drag-to-scroll per scroller
    const makeDragHandlers = () => {
        const ref = { current: null as HTMLDivElement | null };
        let isDownLocal = false;
        let startXLocal = 0;
        let startScrollLeft = 0;
        let raf: number | null = null;
        let latestDxLocal = 0;

        const onPointerDownLocal = (e: React.PointerEvent) => {
            const el = ref.current;
            if (!el) return;
            isDownLocal = true;
            try {
                el.setPointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            startXLocal = e.clientX;
            startScrollLeft = el.scrollLeft;
            latestDxLocal = 0;
            if (raf) {
                cancelAnimationFrame(raf);
                raf = null;
            }
        };

        const onPointerMoveLocal = (e: React.PointerEvent) => {
            const el = ref.current;
            if (!el || !isDownLocal) return;
            e.preventDefault();
            latestDxLocal = e.clientX - startXLocal;
            if (raf == null) {
                raf = requestAnimationFrame(() => {
                    raf = null;
                    const el2 = ref.current;
                    if (!el2) return;
                    el2.scrollLeft = startScrollLeft - latestDxLocal;
                });
            }
        };

        const onPointerUpLocal = (e?: React.PointerEvent) => {
            const el = ref.current;
            if (!el) return;
            isDownLocal = false;
            if (raf) {
                cancelAnimationFrame(raf);
                raf = null;
            }
            // persist current scrollLeft
            startScrollLeft = el.scrollLeft;
            if (e) {
                try {
                    el.releasePointerCapture(e.pointerId);
                } catch {
                    /* ignore */
                }
            }
        };

        return {
            ref,
            onPointerDown: onPointerDownLocal,
            onPointerMove: onPointerMoveLocal,
            onPointerUp: onPointerUpLocal,
            onPointerCancel: onPointerUpLocal,
            onPointerLeave: onPointerUpLocal,
        } as const;
    };

    const dayAHandlers = React.useMemo(() => makeDragHandlers(), []);
    const dayBHandlers = React.useMemo(() => makeDragHandlers(), []);

    return (
        <div className="w-full rounded-lg border bg-background dark:bg-surface-900 shadow-sm transform-gpu transition-transform duration-200 ease-out hover:scale-[1.03] overflow-hidden relative h-full flex flex-col">
            <div className="p-2 border-b">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Programas de ejercicios</h3>
                </div>
            </div>

            <div className="p-3 pb-0 flex-1">
                {/* Día A */}
                <div className="mb-2">
                    <div className="text-sm font-semibold">Día A</div>
                </div>

                <div
                    ref={dayAHandlers.ref as any}
                    className="flex gap-4 pb-1 overflow-x-auto hide-scrollbar cursor-grab select-none px-1"
                    style={{ touchAction: 'pan-x' }}
                    onPointerDown={dayAHandlers.onPointerDown}
                    onPointerMove={dayAHandlers.onPointerMove}
                    onPointerUp={dayAHandlers.onPointerUp}
                    onPointerCancel={dayAHandlers.onPointerCancel}
                    onPointerLeave={dayAHandlers.onPointerLeave}
                >
                    {exercisesA.map((ex, i) => (
                        <div key={i} className="flex-none w-64 min-h-[12rem]">
                            <Card className="overflow-hidden hover:shadow-lg transition-shadow h-[200px] w-64 flex flex-col bg-white rounded-lg border">
                                <CardHeader className="py-2 px-3 h-auto space-y-0.5">
                                    <CardTitle className="text-sm font-semibold line-clamp-2">{ex.name}</CardTitle>
                                    <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
                                        {ex.tags.map((t, idx) => (
                                            <span key={idx} className="bg-muted/10 rounded px-2 py-0.5">{t}</span>
                                        ))}
                                    </div>
                                </CardHeader>

                                <div className="relative bg-slate-200 overflow-hidden flex-1 cursor-auto">
                                    <video
                                        className="w-full h-full object-cover"
                                        src={ex.video}
                                        muted
                                        loop
                                        playsInline
                                        autoPlay
                                        preload="metadata"
                                        aria-hidden
                                    />
                                </div>

                                <div className="px-3 py-2 text-xs text-muted-foreground border-t">—</div>
                            </Card>
                        </div>
                    ))}
                </div>

                {/* Día B (under Día A) */}
                <div className="mt-2 mb-2">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="text-sm font-semibold">Día B</div>
                    </div>

                    <div
                        ref={dayBHandlers.ref as any}
                        className="flex gap-4 pb-1 overflow-x-auto hide-scrollbar cursor-grab select-none px-1"
                        style={{ touchAction: 'pan-x' }}
                        onPointerDown={dayBHandlers.onPointerDown}
                        onPointerMove={dayBHandlers.onPointerMove}
                        onPointerUp={dayBHandlers.onPointerUp}
                        onPointerCancel={dayBHandlers.onPointerCancel}
                        onPointerLeave={dayBHandlers.onPointerLeave}
                    >
                        {exercisesB.map((ex, i) => (
                            <div key={i} className="flex-none w-64 min-h-[12rem]">
                                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-[200px] w-64 flex flex-col bg-white rounded-lg border">
                                    <CardHeader className="py-2 px-3 h-auto space-y-0.5">
                                        <CardTitle className="text-sm font-semibold line-clamp-2">{ex.name}</CardTitle>
                                        <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
                                            {ex.tags.map((t, idx) => (
                                                <span key={idx} className="bg-muted/10 rounded px-2 py-0.5">{t}</span>
                                            ))}
                                        </div>
                                    </CardHeader>

                                    <div className="relative bg-slate-200 overflow-hidden flex-1 cursor-auto">
                                        <video
                                            className="w-full h-full object-cover"
                                            src={ex.video}
                                            muted
                                            loop
                                            playsInline
                                            autoPlay
                                            preload="metadata"
                                            aria-hidden
                                        />
                                    </div>

                                    <div className="px-3 py-2 text-xs text-muted-foreground border-t">—</div>
                                </Card>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
