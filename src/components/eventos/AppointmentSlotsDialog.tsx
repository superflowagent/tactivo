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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { getFilePublicUrl, supabase } from '@/lib/supabase';
import { formatDateWithOffset } from '@/lib/date';
import { CheckCircle } from 'lucide-react';
import { error as logError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import type { Company } from '@/types/company';

interface Slot {
  start: Date;
  end: Date;
  // If slot is associated with a single professional (preferred), this will be set.
  professional?: any;
  // Legacy: when professionals are unavailable we may provide a list
  availableProfessionals?: any[];
}

interface AppointmentSlotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  events: any[]; // expects events with `start` and `end` as Date objects and extendedProps.professional
  professionals: any[]; // profiles for professionals (id/user, name, last_name, photo_path)
}

export function computeAppointmentSlots({
  now = new Date(),
  interval = 15,
  maxDays = 14,
  maxResults = 20,
  company = null,
  events = [],
  professionals = [],
  durationOverride,
  professionalId,
}: {
  now?: Date;
  interval?: number;
  maxDays?: number;
  maxResults?: number;
  company?: Company | null;
  events?: any[];
  professionals?: any[];
  durationOverride?: number | undefined;
  professionalId?: string | undefined | 'all';
}): Slot[] {
  const intervalMs = interval * 60000;
  const results: Slot[] = [];
  const duration = (durationOverride ?? (company?.default_appointment_duration ?? 30)) as number;

  const roundUpToIntervalLocal = (d: Date, intervalMin: number) => {
    const ms = intervalMin * 60000;
    return new Date(Math.ceil(d.getTime() / ms) * ms);
  };

  const parseTimeForDateLocal = (date: Date, timeStr: string) => {
    const [hh = '0', mm = '0'] = (timeStr || '').split(':');
    const d = new Date(date);
    d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    return d;
  };

  const parseDbDatetimeStringToLocal = (raw: any) => {
    if (!raw) return null;
    let s = String(raw);
    if (/[+-]\d{2}$/.test(s)) {
      const fixed = s.replace(/([+-]\d{2})$/, '$1:00');
      s = fixed;
    }
    if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
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
    return new Date(s);
  };

  let candidate = roundUpToIntervalLocal(now, interval);
  const lastDate = new Date(now);
  lastDate.setDate(now.getDate() + maxDays);

  const getEventProfessionalsLocal = (ev: any) => {
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

  const profMatchesAny = (prof: any, ids: string[]) => {
    if (!ids || ids.length === 0) return false;
    const cand = [prof.user, prof.id, prof.user_id].filter(Boolean).map(String);
    return ids.some((id) => cand.includes(String(id)));
  };

  const availableProfessionals = Array.isArray(professionals) ? professionals : [];
  let availableProfessionalsForCompany = company?.id
    ? availableProfessionals.filter((p: any) => String(p.company) === String(company.id) || !p.company)
    : availableProfessionals;

  // If a professionalId filter was provided, restrict to that single professional (unless 'all')
  if (professionalId && professionalId !== 'all') {
    availableProfessionalsForCompany = availableProfessionalsForCompany.filter(
      (p: any) => String(p.id) === String(professionalId) || String(p.user) === String(professionalId)
    );
  }

  while (results.length < maxResults && candidate <= lastDate) {
    const candidateEnd = new Date(candidate.getTime() + duration * 60000);
    const openTimeStr = company?.open_time || '08:00';
    const closeTimeStr = company?.close_time || '20:00';
    const dayOpen = parseTimeForDateLocal(candidate, openTimeStr);
    const dayClose = parseTimeForDateLocal(candidate, closeTimeStr);

    const withinHours = candidate >= dayOpen && candidateEnd <= dayClose;
    const inFuture = candidate >= now;

    if (!withinHours || !inFuture) {
      candidate = new Date(candidate.getTime() + intervalMs);
      continue;
    }

    const eventsForCompany = (events || []).filter((ev: any) => {
      const evCompany = ev._rawEvent?.company ?? ev.company ?? null;
      return company?.id ? String(evCompany) === String(company.id) : true;
    });

    const overlappingEvents = (eventsForCompany || []).filter((ev: any) => {
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

      if (!evStart) evStart = ev.start instanceof Date ? ev.start : new Date(ev.start);
      if (!evEnd) evEnd = ev.end instanceof Date ? ev.end : new Date(ev.end);

      const candMs = candidate.getTime();
      const candEndMs = candidateEnd.getTime();
      const evStartMs = evStart!.getTime();
      const evEndMs = evEnd!.getTime();

      const EPS_MS = 1000;
      return candMs < evEndMs && candEndMs > evStartMs + EPS_MS;
    });

    // Only block if there is at least one overlapping event that has NO professionals assigned
    const overlappingCompanyWide = overlappingEvents.filter((ev: any) => {
      const pros = getEventProfessionalsLocal(ev);
      return !pros || pros.length === 0;
    });

    if (overlappingCompanyWide.length > 0) {
      candidate = new Date(candidate.getTime() + intervalMs);
      continue;
    }

    const overlappingWithProfessionals = overlappingEvents.filter((ev: any) => {
      const pros = getEventProfessionalsLocal(ev);
      return pros && pros.length > 0;
    });

    if (
      (!availableProfessionalsForCompany || availableProfessionalsForCompany.length === 0) &&
      overlappingWithProfessionals.length > 0
    ) {
      candidate = new Date(candidate.getTime() + intervalMs);
      continue;
    }

    const profs =
      availableProfessionalsForCompany && availableProfessionalsForCompany.length > 0
        ? availableProfessionalsForCompany.filter((p) => {
          const busy = overlappingWithProfessionals.some((ev: any) => {
            const pros = getEventProfessionalsLocal(ev);
            return profMatchesAny(p, pros);
          });
          return !busy;
        })
        : [];

    if (
      availableProfessionalsForCompany &&
      availableProfessionalsForCompany.length > 0 &&
      profs.length === 0
    ) {
      candidate = new Date(candidate.getTime() + intervalMs);
      continue;
    }

    if (availableProfessionalsForCompany && availableProfessionalsForCompany.length > 0) {
      profs.forEach((p: any) => {
        results.push({ start: new Date(candidate), end: candidateEnd, professional: p });
      });
    } else {
      results.push({ start: new Date(candidate), end: candidateEnd, availableProfessionals: profs });
    }

    candidate = new Date(candidate.getTime() + intervalMs);
  }

  return results;
}

export function AppointmentSlotsDialog({
  open,
  onOpenChange,
  company,
  events,
  professionals,
}: AppointmentSlotsDialogProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const { user, companyId } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [slotToConfirm, setSlotToConfirm] = useState<Slot | null>(null);
  const [selectedProfForConfirm, setSelectedProfForConfirm] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);


  const capitalize = (s: string) =>
    s && s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const formatSlotDate = (date: Date) => {
    try {
      const weekday = capitalize(
        new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date)
      );
      const day = date.getDate();
      let monthShort = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date);
      // Normalize month (remove trailing dot if present) and keep lower-case as in example
      monthShort = monthShort.replace('.', '').toLowerCase();
      const year = date.getFullYear();
      const time = new Intl.DateTimeFormat('es-ES', { hour: 'numeric', minute: '2-digit' }).format(
        date
      );
      return `${weekday} ${day} ${monthShort} ${year}, ${time}`;
    } catch {
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



  const [selectedProfessional, setSelectedProfessional] = useState<string | 'all'>('all');

  useEffect(() => {
    if (!open) {
      setSlots([]);
      return;
    }

    setLoading(true);

    try {
      const results = computeAppointmentSlots({
        company,
        events,
        professionals,
        professionalId: selectedProfessional,
      });
      setSlots(results);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [open, company, events, professionals, selectedProfessional]);


  const openConfirm = (s: Slot) => {
    setSlotToConfirm(s);
    if (s.professional) {
      const id = s.professional.user || s.professional.id || null;
      setSelectedProfForConfirm(id);
    } else if (s.availableProfessionals && s.availableProfessionals.length === 1) {
      const p = s.availableProfessionals[0];
      setSelectedProfForConfirm(p.user || p.id || null);
    } else {
      setSelectedProfForConfirm(null);
    }
    setConfirmOpen(true);
  };

  const handleConfirmReserve = async () => {
    if (!slotToConfirm) return;
    if (!company?.id && !companyId) {
      alert('Compañía no disponible');
      return;
    }
    if (!selectedProfForConfirm) {
      alert('Por favor selecciona un profesional');
      return;
    }

    setReserving(true);

    try {
      const datetime = slotToConfirm.start;
      const duration = Math.round((slotToConfirm.end.getTime() - slotToConfirm.start.getTime()) / 60000);

      // Prefer profile id if available for client
      let clientArr: string[] = [];
      if (user?.id) {
        try {
          const fetcher = await import('@/lib/supabase');
          const profile = await fetcher.fetchProfileByUserId(user.id);
          clientArr = profile?.id ? [profile.id] : [user.id];
        } catch {
          clientArr = [user.id];
        }
      }

      const payload: any = {
        type: 'appointment',
        datetime: formatDateWithOffset(datetime),
        duration,
        professional: [selectedProfForConfirm],
        client: clientArr,
        company: company?.id ?? companyId,
      };

      const { error: insertErr } = await supabase.rpc('insert_event_json', { p_payload: payload });
      if (insertErr) throw insertErr;

      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 4000);

      setConfirmOpen(false);
      setSlotToConfirm(null);
      setSelectedProfForConfirm(null);

      // Close slots dialog and notify calendar to reload
      onOpenChange(false);
      window.dispatchEvent(new CustomEvent('tactivo.eventCreated'));
    } catch (err) {
      logError('Error creando cita:', err);
      alert('Error reservando la cita');
    } finally {
      setReserving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between w-full gap-4">
            <div className="flex-1">
              <DialogTitle>Agendar cita</DialogTitle>
              <DialogDescription>
                {company ? `Huecos disponibles en ${company.name}` : 'Huecos disponibles'}
              </DialogDescription>
              {company && (
                <div className="text-sm text-muted-foreground mt-1">
                  Horario: {formatTimeNoSeconds(company.open_time)} -{' '}
                  {formatTimeNoSeconds(company.close_time)}
                </div>
              )}
            </div>

            {/* Professional filter dropdown visible for all users (slightly lower and left to avoid close button) */}
            <div className="flex-shrink-0 mt-6 mr-6 w-48">
              <Select value={selectedProfessional} onValueChange={(v) => setSelectedProfessional(v as any)}>
                <SelectTrigger className="section-search">
                  <SelectValue placeholder="Profesional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los profesionales</SelectItem>
                  {(professionals || []).map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name} {prof.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1 px-1 mt-4 pb-4 max-h-[60vh]">
          {loading && <div className="text-sm text-muted-foreground">Calculando huecos…</div>}

          {!loading && slots.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No hay huecos disponibles en el intervalo buscado.
            </div>
          )}

          {!loading &&
            slots.map((s) => (
              <div
                key={`${s.start.toISOString()}-${s.professional?.user || s.professional?.id || 'generic'}`}
                className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted"
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-1 pr-6">
                    <div className="font-medium">{formatSlotDate(s.start)}</div>
                    <div className="text-sm text-muted-foreground">
                      Duración: {Math.round((s.end.getTime() - s.start.getTime()) / 60000)} min
                    </div>
                  </div>

                  <div className="flex-none w-56 flex items-center justify-start pl-4">
                    {s.professional ? (
                      (() => {
                        const p = s.professional;
                        return (
                          <div key={p.user || p.id} className="inline-flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm max-w-max">
                            {p.photo || p.photo_path ? (
                              <img
                                src={
                                  getFilePublicUrl('profile_photos', p.user || p.id, p.photo || p.photo_path || null) || ''
                                }
                                alt={`${p.name} ${p.last_name}`}
                                className="h-6 w-6 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                {(p.name || '')?.charAt(0)}{(p.last_name || '')?.charAt(0)}
                              </div>
                            )}
                            <span className="whitespace-nowrap">{p.name} {p.last_name}</span>
                          </div>
                        );
                      })()
                    ) : s.availableProfessionals && s.availableProfessionals.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {s.availableProfessionals.slice(0, 2).map((p) => (
                          <div key={p.user || p.id} className="inline-flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm max-w-max">
                            {p.photo || p.photo_path ? (
                              <img
                                src={getFilePublicUrl('profile_photos', p.user || p.id, p.photo || p.photo_path || null) || ''}
                                alt={`${p.name} ${p.last_name}`}
                                className="h-6 w-6 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                {(p.name || '')?.charAt(0)}{(p.last_name || '')?.charAt(0)}
                              </div>
                            )}
                            <span className="whitespace-nowrap">{p.name} {p.last_name}</span>
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
                  <Button variant="outline" size="sm" onClick={() => openConfirm(s)}>
                    Reservar
                  </Button>
                </div>
              </div>
            ))}
        </div>

        {/* Confirm reservation alert dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reservar cita</AlertDialogTitle>
            </AlertDialogHeader>

            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">{slotToConfirm ? formatSlotDate(slotToConfirm.start) : ''}</div>
                <div className="text-muted-foreground">
                  Duración: {slotToConfirm ? Math.round((slotToConfirm.end.getTime() - slotToConfirm.start.getTime()) / 60000) : ''} min
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Profesional</div>

                {/* If a single professional is present, show the compact chip */}
                {slotToConfirm?.professional ? (
                  <div className="inline-flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm max-w-max">
                    {slotToConfirm.professional.photo || slotToConfirm.professional.photo_path ? (
                      <img
                        src={getFilePublicUrl('profile_photos', slotToConfirm.professional.user || slotToConfirm.professional.id, slotToConfirm.professional.photo || slotToConfirm.professional.photo_path || null) || ''}
                        alt={`${slotToConfirm.professional.name} ${slotToConfirm.professional.last_name}`}
                        className="h-6 w-6 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                        {String(slotToConfirm.professional.name || '')?.charAt(0)}{String(slotToConfirm.professional.last_name || '')?.charAt(0)}
                      </div>
                    )}
                    <span className="whitespace-nowrap">{slotToConfirm.professional.name} {slotToConfirm.professional.last_name}</span>
                  </div>
                ) : slotToConfirm?.availableProfessionals && slotToConfirm.availableProfessionals.length > 1 ? (
                  <div>
                    {/* show selected chip if chosen */}
                    {selectedProfForConfirm ? (
                      (() => {
                        const p = slotToConfirm.availableProfessionals.find((x: any) => String(x.user || x.id) === String(selectedProfForConfirm));
                        if (p) {
                          return (
                            <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm mb-2">
                              {p.photo || p.photo_path ? (
                                <img
                                  src={getFilePublicUrl('profile_photos', p.user || p.id, p.photo || p.photo_path || null) || ''}
                                  alt={`${p.name} ${p.last_name}`}
                                  className="h-6 w-6 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                  {String(p.name || '')?.charAt(0)}{String(p.last_name || '')?.charAt(0)}
                                </div>
                              )}
                              <span className="truncate">{p.name} {p.last_name}</span>
                            </div>
                          );
                        }
                        return null;
                      })()
                    ) : (
                      <div className="text-sm text-muted-foreground mb-2">Selecciona un profesional</div>
                    )}

                    <Select value={selectedProfForConfirm ?? ''} onValueChange={(v) => setSelectedProfForConfirm(v as any)}>
                      <SelectTrigger className="section-search"><SelectValue placeholder="Selecciona un profesional" /></SelectTrigger>
                      <SelectContent>
                        {slotToConfirm.availableProfessionals.map((p: any) => (
                          <SelectItem key={p.user || p.id} value={p.user || p.id}>
                            <div className="flex items-center gap-2">
                              {p.photo || p.photo_path ? (
                                <img
                                  src={getFilePublicUrl('profile_photos', p.user || p.id, p.photo || p.photo_path || null) || ''}
                                  alt={`${p.name} ${p.last_name}`}
                                  className="h-6 w-6 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                  {p.name?.charAt(0)}{p.last_name?.charAt(0)}
                                </div>
                              )}
                              <span>{p.name} {p.last_name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : slotToConfirm?.availableProfessionals && slotToConfirm.availableProfessionals.length === 1 ? (
                  <div className="inline-flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm max-w-max">
                    {slotToConfirm.availableProfessionals[0].photo || slotToConfirm.availableProfessionals[0].photo_path ? (
                      <img
                        src={getFilePublicUrl('profile_photos', slotToConfirm.availableProfessionals[0].user || slotToConfirm.availableProfessionals[0].id, slotToConfirm.availableProfessionals[0].photo || slotToConfirm.availableProfessionals[0].photo_path || null) || ''}
                        alt={`${slotToConfirm.availableProfessionals[0].name} ${slotToConfirm.availableProfessionals[0].last_name}`}
                        className="h-6 w-6 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                        {String(slotToConfirm.availableProfessionals[0].name || '')?.charAt(0)}{String(slotToConfirm.availableProfessionals[0].last_name || '')?.charAt(0)}
                      </div>
                    )}
                    <span className="whitespace-nowrap">{slotToConfirm.availableProfessionals[0].name} {slotToConfirm.availableProfessionals[0].last_name}</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">Sin profesional</div>
                )}
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmReserve} className="bg-primary text-primary-foreground">
                {reserving ? 'Reservando...' : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>

        {showSuccessAlert && (
          <div className="fixed bottom-4 right-4 z-50 w-96">
            <Alert className="border-green-500 bg-green-50 [&>svg]:top-3.5 [&>svg+div]:translate-y-0">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="flex items-start gap-2">
                  <p className="font-semibold text-green-800">Cita reservada correctamente</p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AppointmentSlotsDialog;
