import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dumbbell, AlertCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase, getFilePublicUrl } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';
import type { Event } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
import { getProfilesByIds, getProfilesByRole } from '@/lib/profiles';

interface ClassSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot?: Event | null;
  dayOfWeek: number; // 1=Monday, 2=Tuesday, etc.
  onSave: (refresh?: boolean) => void;
  onDeleteRequest?: (slot: Event) => void;
}

export function ClassSlotDialog({
  open,
  onOpenChange,
  slot,
  dayOfWeek,
  onSave,
  onDeleteRequest,
}: ClassSlotDialogProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { companyId } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<Event>>({
    type: 'class',
    duration: 60,
    notes: '',
  });
  const [hora, setHora] = useState<string>('10');
  const [minutos, setMinutos] = useState<string>('00');
  const [clientes, setClientes] = useState<any[]>([]);
  const [profesionales, setProfesionales] = useState<any[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMaxAssistantsDialog, setShowMaxAssistantsDialog] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [missingProfiles, setMissingProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const handleInternalDelete = async () => {
    if (!slot?.id) return;
    if (!confirm('¿Eliminar plantilla? Esta acción no se puede deshacer.')) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('classes_templates').delete().eq('id', slot.id);
      if (error) throw error;
      onSave();
      onOpenChange(false);
    } catch (err: any) {
      logError('Error eliminando plantilla:', err);
      alert(`Error al eliminar la plantilla: ${err?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    try {
      // Use RPC to fetch company row and avoid RLS/permission issues
      const { data: comp, error: compErr } = await supabase.rpc('get_company_by_id', {
        p_company: companyId,
      });
      if (compErr) throw compErr;
      const record = Array.isArray(comp) ? comp[0] : comp;
      setCompany(record);
    } catch (err) {
      logError('Error cargando company:', err);
    }
  }, [companyId]);

  const loadClientes = useCallback(async () => {
    if (!companyId) return;

    try {
      const records = await getProfilesByRole(companyId, 'client');
      setClientes(records);
    } catch (err) {
      logError('Error cargando clientes desde profiles:', err);
    }
  }, [companyId]);

  const loadProfesionales = useCallback(async () => {
    if (!companyId) return;

    try {
      const records = await getProfilesByRole(companyId, 'professional');
      setProfesionales(records);
    } catch (err) {
      logError('Error cargando profesionales desde profiles:', err);
    }
  }, [companyId]);

  useEffect(() => {
    let mounted = true;
    if (!selectedClients || selectedClients.length === 0) {
      setProfilesMap({});
      setMissingProfiles([]);
      return;
    }

    (async () => {
      try {
        setProfilesLoading(true);
        const map = await getProfilesByIds(selectedClients, companyId ?? undefined);
        if (!mounted) return;
        setProfilesMap(map);
      } catch (err) {
        logError('Error cargando perfiles para asistentes:', err);
      } finally {
        if (mounted) setProfilesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedClients, companyId]);

  useEffect(() => {
    if (showMaxAssistantsDialog) {
      const timer = setTimeout(() => {
        setShowMaxAssistantsDialog(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showMaxAssistantsDialog]);

  useEffect(() => {
    if (!open) {
      setShowMaxAssistantsDialog(false);
      // Reset form data when closing
      setFormData({
        type: 'class',
        duration: 60,
        notes: '',
      });
      setHora('10');
      setMinutos('00');
      setSelectedClients([]);
      setSelectedProfessionals([]);
      setClientSearch('');
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      loadClientes();
      loadProfesionales();
      loadCompany();
    }
  }, [open, loadClientes, loadProfesionales, loadCompany]);

  useEffect(() => {
    if (!open) return;

    if (slot) {
      setFormData({
        type: 'class',
        duration: slot.duration || company?.default_class_duration || 60,
        notes: slot.notes || '',
      });

      if ((slot as any).time) {
        const [h = '10', m = '00'] = (slot as any).time.split(':');
        setHora(h.toString().padStart(2, '0'));
        setMinutos(m.toString().padStart(2, '0'));
      } else if (slot.datetime) {
        const date = new Date(slot.datetime);
        setHora(date.getHours().toString().padStart(2, '0'));
        setMinutos(date.getMinutes().toString().padStart(2, '0'));
      } else {
        setHora('10');
        setMinutos('00');
      }

      setSelectedClients(
        Array.isArray(slot.client) ? slot.client : slot.client ? [slot.client] : []
      );
      setSelectedProfessionals(
        Array.isArray(slot.professional)
          ? slot.professional
          : slot.professional
            ? [slot.professional]
            : []
      );
    } else {
      setFormData({
        type: 'class',
        duration: company?.default_class_duration || 60,
        notes: '',
      });
      setHora('10');
      setMinutos('00');
      setSelectedClients([]);
      setSelectedProfessionals([]);
    }
  }, [slot, company, open]);

  // Auto-select the first available professional for new classes
  useEffect(() => {
    if (!open) return;
    if (slot) return; // editing an existing slot — don't override
    if (profesionales && profesionales.length > 0 && (selectedProfessionals || []).length === 0) {
      setSelectedProfessionals([profesionales[0].id]);
    }
  }, [open, slot, profesionales, selectedProfessionals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar límite de clientes
    if (company?.max_class_assistants && selectedClients.length > company.max_class_assistants) {
      alert(`El número máximo de clientes es ${company.max_class_assistants}`);
      return;
    }

    try {
      setLoading(true);

      // Guardar como plantilla con day/time en lugar de datetime
      const data = {
        type: 'class',
        day: dayOfWeek,
        time: `${hora}:${minutos}`,
        duration: formData.duration,
        client: selectedClients,
        professional: selectedProfessionals,
        company: companyId,
        notes: formData.notes || '',
      };

      if (slot?.id) {
        const { error } = await supabase.from('classes_templates').update(data).eq('id', slot.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes_templates').insert(data);
        if (error) throw error;
      }

      onSave();
      onOpenChange(false);
    } catch (err: any) {
      logError('Error al guardar clase:', err);
      alert(`Error al guardar la clase: ${err?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              {slot?.id ? 'Editar Plantilla - Clase' : 'Crear Plantilla - Clase'}
            </DialogTitle>
            <DialogDescription>
              Completa los datos de la clase del {dayNames[dayOfWeek]}
            </DialogDescription>
          </DialogHeader>

          <form
            id="class-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto space-y-6 px-1"
          >
            {/* Hora y Duración */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hora">Hora *</Label>
                <div className="flex gap-2">
                  <Select value={hora} onValueChange={setHora}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                        <SelectItem key={h} value={h.toString().padStart(2, '0')}>
                          {h.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex items-center">:</span>
                  <Select value={minutos} onValueChange={setMinutos}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['00', '15', '30', '45'].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duración (min) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration || 60}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, duration: parseInt(e.target.value) }))
                  }
                  required
                />
              </div>
            </div>

            {/* Clientes */}
            <div className="space-y-2">
              <Label>
                Clientes
                {company?.max_class_assistants && (
                  <span className="text-muted-foreground ml-2">
                    ({selectedClients.length}/{company.max_class_assistants})
                  </span>
                )}
              </Label>
              {(selectedClients.length > 0 || profilesLoading) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedClients.map((clientId) => {
                    const card = profilesMap[clientId];

                    if (card) {
                      return (
                        <div
                          key={clientId}
                          className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm"
                        >
                          {card.photoUrl ? (
                            <img
                              src={card.photoUrl}
                              alt={`${card.name} ${card.last_name}`}
                              className="h-6 w-6 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                              {String(card.name || '')?.charAt(0)}
                              {String(card.last_name || '')?.charAt(0)}
                            </div>
                          )}
                          <span className="truncate">
                            {card.name} {card.last_name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedClients((prev) => prev.filter((id) => id !== clientId))
                            }
                            className="hover:text-destructive ml-2"
                            aria-label={`Eliminar ${card.name} ${card.last_name}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    }

                    if (profilesLoading) {
                      return (
                        <div
                          key={clientId}
                          className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm animate-pulse"
                        >
                          <div className="h-6 w-6 rounded bg-muted-foreground/20" />
                          <div className="flex-1 h-4 bg-muted-foreground/20 rounded" />
                        </div>
                      );
                    }

                    // Try to find cliente from preloaded `clientes` to avoid flicker
                    const cliente = clientes.find((c) => c.user === clientId);
                    if (cliente) {
                      const photoUrl =
                        cliente.photoUrl ||
                        cliente.photo ||
                        (cliente.photo_path
                          ? getFilePublicUrl('profile_photos', cliente.id, cliente.photo_path)
                          : null);
                      return (
                        <div
                          key={clientId}
                          className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm"
                        >
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={`${cliente.name} ${cliente.last_name}`}
                              className="h-6 w-6 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                              {String(cliente.name || '')?.charAt(0)}
                              {String(cliente.last_name || '')?.charAt(0)}
                            </div>
                          )}
                          <span className="truncate">
                            {cliente.name} {cliente.last_name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedClients((prev) => prev.filter((id) => id !== clientId))
                            }
                            className="hover:text-destructive ml-2"
                            aria-label={`Eliminar ${cliente.name} ${cliente.last_name}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    }

                    // If still not found, show nothing (match EventDialog behavior)
                    return null;
                  })}
                </div>
              )}
              <div className="space-y-2 relative">
                <Input
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="text-sm h-10"
                />
                {clientSearch && (
                  <div className="absolute left-0 mt-1 w-1/2 border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 z-50 bg-background pointer-events-auto">
                    {(() => {
                      const normalizedSearch = clientSearch
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .toLowerCase();
                      const filtered = clientes
                        .filter((cliente) => {
                          const normalizedClientName = (cliente.name + ' ' + cliente.last_name)
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase();
                          return normalizedClientName.includes(normalizedSearch);
                        })
                        .filter((cliente) => !selectedClients.includes(cliente.id));

                      if (filtered.length === 0) {
                        return <div className="px-2 py-1 text-sm text-black">Sin resultados</div>;
                      }

                      return filtered.map((cliente) => {
                        const photoUrl =
                          cliente.photoUrl ||
                          cliente.photo ||
                          (cliente.photo_path
                            ? getFilePublicUrl('profile_photos', cliente.id, cliente.photo_path)
                            : null);
                        return (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => {
                              // Validar límite de asistentes para clases
                              if (
                                company?.max_class_assistants &&
                                selectedClients.length >= company.max_class_assistants
                              ) {
                                setShowMaxAssistantsDialog(true);
                                return;
                              }
                              setSelectedClients((prev) => [...prev, cliente.id]);
                              setClientSearch('');
                            }}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center gap-2"
                          >
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={`${cliente.name} ${cliente.last_name}`}
                                className="h-8 w-8 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                {String(cliente.name || '')?.charAt(0)}
                                {String(cliente.last_name || '')?.charAt(0)}
                              </div>
                            )}
                            <div className="flex-1 flex items-center justify-between">
                              <span>
                                {cliente.name} {cliente.last_name}
                              </span>
                              <span
                                className={`text-xs font-medium ml-2 ${(cliente.class_credits || 0) <= 0 ? 'text-orange-600' : 'text-muted-foreground'}`}
                              >
                                {cliente.class_credits || 0} créditos
                              </span>
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Profesional */}
            <div className="space-y-2">
              <Label>Profesional *</Label>
              {selectedProfessionals.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedProfessionals.map((profId) => {
                    const prof = profesionales.find((p) => p.id === profId || p.user === profId);
                    return prof ? (
                      <div
                        key={profId}
                        className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm"
                      >
                        {prof.photoUrl ? (
                          <img
                            src={prof.photoUrl}
                            alt={`${prof.name} ${prof.last_name}`}
                            className="h-6 w-6 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                            {String(prof.name || '')?.charAt(0)}
                            {String(prof.last_name || '')?.charAt(0)}
                          </div>
                        )}
                        <span className="truncate">
                          {prof.name} {prof.last_name}
                        </span>
                        {selectedProfessionals.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedProfessionals((prev) => prev.filter((id) => id !== profId))
                            }
                            className="hover:text-destructive ml-2"
                            aria-label={`Eliminar ${prof.name} ${prof.last_name}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !selectedProfessionals.includes(value)) {
                    setSelectedProfessionals((prev) => [...prev, value]);
                  }
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Añadir profesional" />
                </SelectTrigger>
                <SelectContent>
                  {profesionales.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      <div className="flex items-center gap-2">
                        {prof.photoUrl ? (
                          <img
                            src={prof.photoUrl}
                            alt={`${prof.name} ${prof.last_name}`}
                            className="h-6 w-6 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                            {prof.name?.charAt(0)}
                            {prof.last_name?.charAt(0)}
                          </div>
                        )}
                        <span>
                          {prof.name} {prof.last_name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <LazyRichTextEditor
                value={formData.notes || ''}
                onChange={(value: string) => setFormData((prev) => ({ ...prev, notes: value }))}
              />
            </div>
          </form>

          <DialogFooter className="mt-4">
            <div className="flex w-full justify-between">
              <div>
                {slot?.id && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (onDeleteRequest) {
                        onDeleteRequest(slot);
                      } else {
                        handleInternalDelete();
                      }
                    }}
                    disabled={loading}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="class-form"
                  disabled={loading || missingProfiles.length > 0}
                >
                  {loading ? (
                    <>
                      Guardando
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!slot?.id) return;
                try {
                  setLoading(true);
                  const { error } = await supabase
                    .from('classes_templates')
                    .delete()
                    .eq('id', slot.id);
                  if (error) throw error;
                  onSave();
                  onOpenChange(false);
                  setShowDeleteDialog(false);
                } catch (err: any) {
                  logError('Error eliminando plantilla:', err);
                  alert(`Error al eliminar la plantilla: ${err?.message || 'Error desconocido'}`);
                } finally {
                  setLoading(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showMaxAssistantsDialog && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto z-[100] w-auto md:max-w-md animate-in slide-in-from-right">
          <Alert className="border-destructive/50 text-destructive [&>svg]:top-3.5 [&>svg+div]:translate-y-0 bg-[hsl(var(--background))]">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Número máximo de asistentes alcanzado</AlertTitle>
            <AlertDescription>
              El número máximo de clientes para las clases es {company?.max_class_assistants}.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
}
