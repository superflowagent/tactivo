import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFilePublicUrl, supabase } from '@/lib/supabase';
import { formatDateWithOffset } from '@/lib/date';
import type { Company } from '@/types/company';

interface Slot {
    start: Date;
    end: Date;
    availableProfessionals: any[]; // array of professional profiles
}

interface AppointmentSlotsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company: Company | null;
    events: any[]; // expects events with `start` and `end` as Date objects and extendedProps.professional
    professionals: any[]; // profiles for professionals (id/user, name, last_name, photo_path)
}

export function AppointmentSlotsDialog({ open, onOpenChange, company, events, professionals }: AppointmentSlotsDialogProps) {
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(false);

    const roundUpToInterval = (d: Date, intervalMin: number) => {
        const ms = intervalMin * 60000;
        return new Date(Math.ceil(d.getTime() / ms) * ms);
    };

    const parseTimeForDate = (date: Date, timeStr: string) => {
        const [hh = '0', mm = '0'] = (timeStr || '').split(':');
        const d = new Date(date);
        d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
        return d;
    };

    const capitalize = (s: string) => (s && s.length > 0) ? s.charAt(0).toUpperCase() + s.slice(1) : s;

    const formatSlotDate = (date: Date) => {
        try {
            const weekday = capitalize(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date));
            const day = date.getDate();
            let monthShort = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date);
            // Normalize month (remove trailing dot if present) and keep lower-case as in example
            monthShort = monthShort.replace('.', '').toLowerCase();
            const year = date.getFullYear();
            const time = new Intl.DateTimeFormat('es-ES', { hour: 'numeric', minute: '2-digit' }).format(date);
            return `${weekday} ${day} ${monthShort} ${year}, ${time}`;
        } catch (err) {
            return date.toLocaleString();
        }
    };

    const formatTimeNoSeconds = (timeStr: string | undefined | null) => {
        if (!timeStr) return '';
        const parts = String(timeStr).split(':');
        if (parts.length < 2) return timeStr;
        const hh = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        return `${hh}:${mm}`;
    };

    // Extract professional ids from event representations (supports multiple shapes)
    const getEventProfessionals = (ev: any) => {
        const ids = new Set<string>();
        const add = (val: any) => {
            if (!val) return;
            if (Array.isArray(val)) {
                val.forEach((v) => v && ids.add(String(v)));
            } else {
                ids.add(String(val));
            }
        };

        add(ev?.extendedProps?.professional);
        add(ev?._rawEvent?.professional);
        add(ev?.professional);

        return Array.from(ids);
    };

    useEffect(() => {
        if (!open) {
            setSlots([]);
            return;
        }

        setLoading(true);

        (async () => {
            try {
                const interval = 15; // minutes
                const duration = (company?.default_appointment_duration ?? 30) as number; // mins
                const now = new Date();
                let candidate = roundUpToInterval(now, interval);
                const maxDays = 14; // search window cap
                const lastDate = new Date(now);
                lastDate.setDate(now.getDate() + maxDays);

                const results: Slot[] = [];

                // We'll scan forward in interval steps until we collect 20 slots or exceed search window
                while (results.length < 20 && candidate <= lastDate) {
                    // slot end
                    const candidateEnd = new Date(candidate.getTime() + duration * 60000);

                    // company open/close for that date (interpreted as wall-clock times of the company)
                    const openTimeStr = company?.open_time || '08:00';
                    const closeTimeStr = company?.close_time || '20:00';
                    const dayOpen = parseTimeForDate(candidate, openTimeStr);
                    const dayClose = parseTimeForDate(candidate, closeTimeStr);

                    // candidate must be within the same day's open-close window
                    const withinHours = candidate >= dayOpen && candidateEnd <= dayClose;

                    // candidate must be in the future (>= now)
                    const inFuture = candidate >= now;

                    // overlapping events
                    // Use millisecond arithmetic and a small tolerance to avoid false
                    // overlaps when a candidate ends exactly at the start of an event
                    // (i.e., touching endpoints should NOT be considered overlapping).
                    const EPS_MS = 1000; // 1 second tolerance
                    // Helper: parse DB datetime strings WITHOUT timezone as local wall-clock
                    const parseDbDatetimeStringToLocal = (raw: any) => {
                        if (!raw) return null;
                        let s = String(raw);
                        // Normalize offset-only representations like '+00' -> '+00:00' so Date parser accepts them
                        if (/[+-]\d{2}$/.test(s)) {
                            const fixed = s.replace(/([+-]\d{2})$/, '$1:00');
                            if (process.env.NODE_ENV === 'development' && fixed !== s) {
                                // eslint-disable-next-line no-console
                                console.debug('AppointmentSlotsDialog: normalized offset format', { raw: s, fixed });
                            }
                            s = fixed;
                        }

                        // If string contains explicit timezone (Z or +hh:mm), use Date parsing
                        if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);

                        // Try to parse YYYY-MM-DDTHH:mm[:ss] as local time
                        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):?(\d{2})(?::?(\d{2}))?$/);
                        if (m) {
                            const year = parseInt(m[1], 10);
                            const month = parseInt(m[2], 10) - 1;
                            const day = parseInt(m[3], 10);
                            const hour = parseInt(m[4], 10);
                            const minute = parseInt(m[5], 10);
                            const second = m[6] ? parseInt(m[6], 10) : 0;
                            return new Date(year, month, day, hour, minute, second);
                        }

                        // Fallback to Date constructor
                        return new Date(s);
                    };

                    const overlappingEvents = (events || []).filter((ev: any) => {
                        // Prefer raw values from DB for precise behavior (especially for vacations)
                        const rawDt = ev._rawEvent?.datetime ?? ev.datetime ?? null;
                        const rawDur = ev._rawEvent?.duration ?? ev.duration ?? 0;

                        let evStart: Date | null = null;
                        let evEnd: Date | null = null;

                        if (rawDt) {
                            const parsed = parseDbDatetimeStringToLocal(rawDt);
                            if (parsed && !isNaN(parsed.getTime())) {
                                evStart = parsed;
                                evEnd = new Date(parsed.getTime() + (rawDur || 0) * 60000);
                            }
                        }

                        // Fallback to already-normalized Date objects when raw parsing fails
                        if (!evStart) evStart = ev.start instanceof Date ? ev.start : new Date(ev.start);
                        if (!evEnd) evEnd = ev.end instanceof Date ? ev.end : new Date(ev.end);

                        const candMs = candidate.getTime();
                        const candEndMs = candidateEnd.getTime();
                        const evStartMs = evStart.getTime();
                        const evEndMs = evEnd.getTime();

                        // Treat as overlapping only if candidate starts before event end
                        // AND candidate ends strictly after event start by at least EPS_MS
                        return candMs < evEndMs && candEndMs > evStartMs + EPS_MS;
                    });

                    // DEV: diagnostics for all events to detect parsing/timezone mismatches
                    if (process.env.NODE_ENV === 'development') {
                        try {
                            (events || []).forEach((ev: any) => {
                                const t = ev._rawEvent?.type || ev.extendedProps?.type || ev.type;
                                const rawDt = ev._rawEvent?.datetime ?? ev.datetime ?? null;
                                const rawDur = ev._rawEvent?.duration ?? ev.duration ?? null;

                                // parsed from raw DB fields using the same local-wall-clock parser
                                const parsedStart = rawDt ? parseDbDatetimeStringToLocal(rawDt) : null;
                                const parsedEnd = parsedStart ? new Date(parsedStart.getTime() + (rawDur || 0) * 60000) : null;

                                const evStart = ev.start instanceof Date ? ev.start : new Date(ev.start);
                                const evEnd = ev.end instanceof Date ? ev.end : new Date(ev.end);

                                const deltaStart = parsedStart && evStart ? parsedStart.getTime() - evStart.getTime() : null;
                                const deltaEnd = parsedEnd && evEnd ? parsedEnd.getTime() - evEnd.getTime() : null;

                                // eslint-disable-next-line no-console
                                console.debug('event-parse-diagnostic', {
                                    id: ev.id || ev._rawEvent?.id,
                                    type: t,
                                    rawDatetime: rawDt,
                                    rawDuration: rawDur,
                                    parsedStartIso: parsedStart?.toISOString?.(),
                                    parsedEndIso: parsedEnd?.toISOString?.(),
                                    evStartIso: evStart?.toISOString?.(),
                                    evEndIso: evEnd?.toISOString?.(),
                                    deltaStart,
                                    deltaEnd,
                                    professionals: getEventProfessionals(ev),
                                });
                            });
                        } catch (e) {
                            // ignore dev diagnostics errors
                        }
                    }



                    // Skip if out of company hours or in the past
                    if (!withinHours || !inFuture) {
                        candidate = new Date(candidate.getTime() + interval * 60000);
                        continue;
                    }

                    // Determine overlapping events that have assigned professionals (only those matter for blocking)
                    const overlappingWithProfessionals = overlappingEvents.filter((ev: any) => {
                        const pros = getEventProfessionals(ev);
                        return pros && pros.length > 0;
                    });

                    // DEV: log availability diagnostics for this candidate
                    if (process.env.NODE_ENV === 'development') {
                        try {
                            const availProfIds = (Array.isArray(professionals) ? professionals : []).map((p:any) => String(p.id || p.user || p.user_id));
                            const overlappingSummary = overlappingWithProfessionals.map((ev:any) => ({ id: ev.id || ev._rawEvent?.id, type: ev._rawEvent?.type || ev.type, professionals: getEventProfessionals(ev) }));
                            // eslint-disable-next-line no-console
                            console.debug('AppointmentSlotsDialog: candidate-debug', {
                                candidate: candidate.toISOString(),
                                candidateEnd: candidateEnd.toISOString(),
                                overlappingCount: overlappingEvents.length,
                                overlappingWithProfessionalsCount: overlappingWithProfessionals.length,
                                overlappingSummary,
                                availableProfessionalsCount: availProfIds.length,
                                availableProfessionals: availProfIds,
                            });
                        } catch (e) {
                            // ignore
                        }
                    }



                    // Compute which professionals are available
                    const availableProfessionals = Array.isArray(professionals) ? professionals : [];

                    // If professionals are not yet loaded: block only when there is an overlapping event that has professionals assigned
                    if ((!availableProfessionals || availableProfessionals.length === 0) && overlappingWithProfessionals.length > 0) {
                        if (process.env.NODE_ENV === 'development') console.debug('skip candidate: professionals not loaded and overlappingWithProfessionals exists', { candidate: candidate.toISOString(), overlappingWithProfessionals: overlappingWithProfessionals.length });
                        candidate = new Date(candidate.getTime() + interval * 60000);
                        continue;
                    }

                    // Helper to check if a professional profile matches one of the ids stored on an event
                    const profMatchesAny = (prof: any, ids: string[]) => {
                        if (!ids || ids.length === 0) return false;
                        const cand = [prof.user, prof.id, prof.user_id].filter(Boolean).map(String);
                        return ids.some((id) => cand.includes(String(id)));
                    };

                    // Filter out professionals busy in overlapping events (consider only overlappingWithProfessionals)
                    const profs = (availableProfessionals && availableProfessionals.length > 0)
                        ? availableProfessionals.filter((p) => {
                            const busy = overlappingWithProfessionals.some((ev: any) => {
                                const pros = getEventProfessionals(ev);
                                return profMatchesAny(p, pros);
                            });
                            return !busy;
                        })
                        : [];

                    // If professionals list is provided and none are free, skip the slot since nobody can attend
                    if (availableProfessionals && availableProfessionals.length > 0 && profs.length === 0) {
                        candidate = new Date(candidate.getTime() + interval * 60000);
                        continue;
                    }

                    // Offer the slot (even if overlapping events exist without professionals assigned)
                    results.push({ start: new Date(candidate), end: candidateEnd, availableProfessionals: profs });

                    // advance by interval
                    candidate = new Date(candidate.getTime() + interval * 60000);
                }

                setSlots(results);
            } catch (err) {
                console.error('Error computing appointment slots:', err);
                setSlots([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [open, company, events, professionals]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Agendar cita</DialogTitle>
                    <DialogDescription>
                        {company ? `Huecos disponibles en ${company.name}` : 'Huecos disponibles'}
                    </DialogDescription>
                    {company && (
                        <div className="text-sm text-muted-foreground mt-1">Horario: {formatTimeNoSeconds(company.open_time)} - {formatTimeNoSeconds(company.close_time)}</div>
                    )}
                </DialogHeader>

                <div className="space-y-3 overflow-y-auto flex-1 px-1 mt-4 pb-4 max-h-[60vh]">
                    {loading && <div className="text-sm text-muted-foreground">Calculando huecos…</div>}

                    {!loading && slots.length === 0 && (
                        <div className="text-sm text-muted-foreground">No hay huecos disponibles en el intervalo buscado.</div>
                    )}

                    {!loading && slots.map((s) => (
                        <div key={s.start.toISOString()} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted">
                            <div className="flex items-center gap-4 w-full">
                                <div className="flex-1">
                                    <div className="font-medium">{formatSlotDate(s.start)}</div>
                                    <div className="text-sm text-muted-foreground">Duración: {Math.round((s.end.getTime() - s.start.getTime()) / 60000)} min</div>
                                </div>

                                <div className="flex-1 flex justify-center">
                                    {s.availableProfessionals && s.availableProfessionals.length > 0 ? (
                                        <div className="flex items-center gap-4">
                                            {s.availableProfessionals.slice(0, 2).map((p) => (
                                                <div key={p.user || p.id} className="flex items-center gap-2">
                                                    {p.photo || p.photo_path ? (
                                                        <img
                                                            src={getFilePublicUrl('profile_photos', p.user || p.id, p.photo || p.photo_path || null) || ''}
                                                            alt={`${p.name} ${p.last_name}`}
                                                            className="w-8 h-8 rounded-md object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs font-medium">
                                                            {(p.name || '')?.charAt(0)}{(p.last_name || '')?.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div className="text-sm truncate max-w-[140px]">
                                                        <div className="truncate">{p.name} {p.last_name}</div>
                                                    </div>
                                                </div>
                                            ))}

                                            {s.availableProfessionals.length > 2 && (
                                                <div className="text-sm text-muted-foreground">+{s.availableProfessionals.length - 2} más</div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex-shrink-0">
                                {/* No reservamos aún; dejamos el botón inactivo por ahora */}
                                <Button variant="outline" size="sm" disabled>
                                    Reservar
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter className="mt-4">
                    <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default AppointmentSlotsDialog;
