import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const exercisesA = [
    { name: 'Sentadilla búlgara', tags: ['Pesa', 'Tobillo'], video: encodeURI(`${import.meta.env.BASE_URL}landing/exercises/Extensión columna.mp4`) },
    { name: 'Fondos', tags: ['Goma'], video: encodeURI(`${import.meta.env.BASE_URL}landing/exercises/Rezo al cielo.mp4`) },
    { name: 'Dominadas', tags: ['Goma'], video: encodeURI(`${import.meta.env.BASE_URL}landing/exercises/Movilidad escapular.mp4`) },
];

const exercisesB = [
    { name: 'Plancha lateral', tags: ['Isométrico'], video: encodeURI(`${import.meta.env.BASE_URL}landing/exercises/Apertura desde suelo.mp4`) },
    { name: 'Abdominales', tags: ['Piso'], video: encodeURI(`${import.meta.env.BASE_URL}landing/exercises/Rotación externa.mp4`) },
    { name: 'Fondos con peso', tags: ['Peso'], video: encodeURI(`${import.meta.env.BASE_URL}landing/exercises/Rotación en pared.mp4`) },
];

// Helper: derive a user-friendly title from the video file path (e.g. "vuelta-al-mundo.mp4" -> "Vuelta Al Mundo")
function titleFromVideo(video: string) {
    try {
        const parts = video.split('/');
        const file = parts[parts.length - 1] || video;
        const noExt = file.replace(/\.[^/.]+$/, '');
        const decoded = decodeURIComponent(noExt);
        const cleaned = decoded.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
        return cleaned
            .split(' ')
            .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
            .join(' ');
    } catch {
        return video;
    }
}

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
                        <div key={i} className="flex-none w-52 min-h-[12rem]">
                            <Card className="overflow-hidden hover:shadow-lg transition-shadow w-52 flex flex-col bg-white rounded-lg border">
                                <CardHeader className="py-2 px-3 h-auto space-y-0.5">
                                    <CardTitle className="text-sm font-semibold line-clamp-2">{titleFromVideo(ex.video)}</CardTitle>
                                    <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
                                        {ex.tags.map((t, idx) => {
                                            const bgClass = ['Pesa', 'Peso', 'Goma'].includes(t) ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-orange-100 text-orange-800 border-orange-200';
                                            return (
                                                <Badge key={idx} variant="secondary" className={`text-xs truncate ${bgClass} cursor-default`}>
                                                    {t}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </CardHeader>

                                <div className="relative bg-slate-200 overflow-hidden cursor-auto">
                                    <div className="w-full pt-[75%] relative">
                                        <video
                                            className="absolute inset-0 w-full h-full object-cover"
                                            src={ex.video}
                                            muted
                                            loop
                                            playsInline
                                            autoPlay
                                            preload="metadata"
                                            aria-hidden
                                        />
                                    </div>
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
                            <div key={i} className="flex-none w-52 min-h-[12rem]">
                                <Card className="overflow-hidden hover:shadow-lg transition-shadow w-52 flex flex-col bg-white rounded-lg border">
                                    <CardHeader className="py-2 px-3 h-auto space-y-0.5">
                                        <CardTitle className="text-sm font-semibold line-clamp-2">{titleFromVideo(ex.video)}</CardTitle>
                                        <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
                                            {ex.tags.map((t, idx) => {
                                                const bgClass = ['Pesa', 'Peso', 'Goma'].includes(t) ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-orange-100 text-orange-800 border-orange-200';
                                                return (
                                                    <Badge key={idx} variant="secondary" className={`text-xs truncate ${bgClass} cursor-default`}>
                                                        {t}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </CardHeader>

                                    <div className="relative bg-slate-200 overflow-hidden cursor-auto">
                                        <div className="w-full pt-[75%] relative">
                                            <video
                                                className="absolute inset-0 w-full h-full object-cover"
                                                src={ex.video}
                                                muted
                                                loop
                                                playsInline
                                                autoPlay
                                                preload="metadata"
                                                aria-hidden
                                            />
                                        </div>
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
