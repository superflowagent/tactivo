import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import ActionButton from '@/components/ui/ActionButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Plus, Pencil, Trash, CalendarRange, CheckCircle, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { getProfilesByIds } from '@/lib/profiles';
import type { Event } from '@/types/event';
import { ClassSlotDialog } from '@/components/clases/ClassSlotDialog';
import { PropagateDialog } from '@/components/clases/PropagateDialog';

const WEEKDAYS = [
  { name: 'Lunes', value: 1 },
  { name: 'Martes', value: 2 },
  { name: 'Miércoles', value: 3 },
  { name: 'Jueves', value: 4 },
  { name: 'Viernes', value: 5 },
];

export function ClasesView() {
  const { companyId } = useAuth();
  const [templateSlots, setTemplateSlots] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<Event | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Event | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [propagateDialogOpen, setPropagateDialogOpen] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [draggedSlot, setDraggedSlot] = useState<Event | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const loadTemplateSlots = useCallback(
    async (_refresh?: boolean) => {
      if (!companyId) return;

      try {
        setLoading(true);
        const cid = companyId;
        // Order by day (1..7) and time to reflect weekly templates
        const { data: records, error } = await supabase
          .from('classes_templates')
          .select('*')
          .eq('company', cid)
          .order('day')
          .order('time');
        if (error) throw error;

        // Enrich with profiles for client and professional ids
        const allIds = new Set<string>();
        (records || []).forEach((r: any) => {
          const pros = Array.isArray(r.professional)
            ? r.professional
            : r.professional
              ? [r.professional]
              : [];
          const clients = Array.isArray(r.client) ? r.client : r.client ? [r.client] : [];
          pros.forEach((id: string) => allIds.add(id));
          clients.forEach((id: string) => allIds.add(id));
        });

        let profileMap: Record<string, any> = {};
        if (allIds.size > 0) {
          const ids = Array.from(allIds);
          const profilesMap = await getProfilesByIds(ids, companyId ?? undefined);
          profileMap = profilesMap || {};
        }

        // Create a synthetic `datetime` for compatibility with other components using Date parsing
        const enriched = (records || []).map((r: any) => {
          const dayNum = typeof r.day === 'number' ? r.day : parseInt(r.day);
          const timeStr = r.time || '10:00';
          const [hours, minutes] = timeStr.split(':').map((s: string) => parseInt(s, 10) || 0);

          // Build a date in the next week that matches the dayOfWeek
          const now = new Date();
          const diff = (dayNum - now.getDay() + 7) % 7 || 7; // ensure a positive diff (1..7)
          const dt = new Date(now);
          dt.setDate(now.getDate() + diff);
          dt.setHours(hours, minutes, 0, 0);

          return {
            ...r,
            datetime: dt.toISOString(),
            expand: {
              client: (Array.isArray(r.client) ? r.client : r.client ? [r.client] : [])
                .map((id: string) => profileMap[id] || null)
                .filter(Boolean),
              professional: (Array.isArray(r.professional)
                ? r.professional
                : r.professional
                  ? [r.professional]
                  : []
              )
                .map((id: string) => profileMap[id] || null)
                .filter(Boolean),
            },
          };
        });

        setTemplateSlots(enriched);
      } catch (err) {
        logError('Error cargando slots:', err);
      } finally {
        setLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    loadTemplateSlots();
  }, [companyId, loadTemplateSlots]);

  const handleDelete = (slot: Event) => {
    setSlotToDelete(slot);
    setDeleteDialogOpen(true);
  };

  const handleEdit = (slot: Event) => {
    setSelectedSlot(slot);
    setSelectedDay(getDayOfWeek(slot.datetime));
    setDialogOpen(true);
  };

  const handleDuplicate = async (slot: Event) => {
    try {
      // Prefer explicit day/time if present in slot, otherwise derive from datetime
      const day = (slot as any).day ?? getDayOfWeek(slot.datetime);
      const time = (slot as any).time ?? getTime(slot.datetime);

      const { error } = await supabase.from('classes_templates').insert({
        day,
        time,
        duration: slot.duration,
        client: slot.client || [],
        professional: slot.professional || [],
        company: slot.company,
        notes: slot.notes || '',
      });
      if (error) throw error;
      await loadTemplateSlots();
    } catch (err) {
      logError('Error duplicando clase:', err);
      alert('Error al duplicar la clase');
    }
  };

  const handleCreate = (dayValue: number) => {
    setSelectedSlot(null);
    setSelectedDay(dayValue);
    setDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!slotToDelete?.id) return;

    try {
      const { error } = await supabase.from('classes_templates').delete().eq('id', slotToDelete.id);
      if (error) throw error;
      await loadTemplateSlots();
      // Close class dialog if it's open and clear selection
      setDialogOpen(false);
      setSelectedSlot(null);
      setDeleteDialogOpen(false);
      setSlotToDelete(null);
    } catch (err) {
      logError('Error eliminando slot:', err);
      alert('Error al eliminar la clase');
    }
  };

  const getDayOfWeek = (datetime: string) => {
    const date = new Date(datetime);
    return date.getDay(); // 0=Sunday, 1=Monday, etc.
  };

  const getTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getProfessionalNames = (slot: any) => {
    // If there is no professional assigned, show the placeholder 'Sin asignar'
    if (!slot.expand?.professional) return 'Sin asignar';
    if (Array.isArray(slot.expand.professional)) {
      if (slot.expand.professional.length === 0) return 'Sin asignar';
      return slot.expand.professional.map((p: any) => `${p.name} ${p.last_name}`).join(', ');
    }
    return `${slot.expand.professional.name} ${slot.expand.professional.last_name}`;
  };

  const getClientCount = (slot: Event) => {
    if (!slot.client) return 0;
    return Array.isArray(slot.client) ? slot.client.length : 1;
  };

  const getSlotsByDay = (dayValue: number) => {
    return templateSlots
      .filter((slot) => getDayOfWeek(slot.datetime) === dayValue)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  };

  const handleDragStart = (e: React.DragEvent, slot: Event) => {
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dayValue: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dayValue);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
    // Don't reset cursor here, wait for drop
  };

  const handleDrop = async (e: React.DragEvent, targetDay: number) => {
    e.preventDefault();
    setDragOverDay(null);

    if (!draggedSlot || !draggedSlot.id) {
      setDraggedSlot(null);
      return;
    }

    const currentDay = getDayOfWeek(draggedSlot.datetime);
    if (currentDay === targetDay) {
      setDraggedSlot(null);
      return;
    }

    try {
      // Calcular nueva fecha manteniendo la hora
      const currentDate = new Date(draggedSlot.datetime);
      const currentDayOfWeek = currentDate.getDay();
      const diff = targetDay - currentDayOfWeek;
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + diff);

      // Formatear time como HH:MM y actualizar day/time en la tabla
      const pad = (n: number) => String(n).padStart(2, '0');
      const newTime = `${pad(newDate.getHours())}:${pad(newDate.getMinutes())}`;

      const { error } = await supabase
        .from('classes_templates')
        .update({ day: targetDay, time: newTime })
        .eq('id', draggedSlot.id);
      if (error) throw error;

      // Recargar los slots
      await loadTemplateSlots();
    } catch (err) {
      logError('Error moviendo clase:', err);
      alert('Error al mover la clase');
    } finally {
      setDraggedSlot(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          className="btn-propagate"
          onClick={() => setPropagateDialogOpen(true)}
          disabled={templateSlots.length === 0}
        >
          <CalendarRange className="mr-2 h-4 w-4" />
          Propagar
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {WEEKDAYS.map((day) => {
                const daySlots = getSlotsByDay(day.value);
                return (
                  <Card
                    key={day.value}
                    className={`border-2 transition-all ${dragOverDay === day.value ? 'bg-primary/10 ring-2 ring-primary shadow-lg' : ''}`}
                    onDragOver={(e) => handleDragOver(e, day.value)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day.value)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center justify-between">
                        {day.name}
                        <ActionButton
                          tooltip="Crear plantilla"
                          onClick={() => handleCreate(day.value)}
                        >
                          <Plus className="h-4 w-4" />
                        </ActionButton>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {daySlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Sin clases</p>
                      ) : (
                        daySlots.map((slot) => (
                          <Card
                            key={slot.id}
                            data-slot-id={slot.id}
                            className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                            draggable
                            onDragStart={(e) => handleDragStart(e, slot)}
                          >
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{getTime(slot.datetime)}</p>
                                </div>

                                <div className="w-full sm:w-auto flex justify-end gap-1 flex-wrap mt-2 sm:mt-0">
                                  <ActionButton
                                    tooltip="Editar"
                                    onClick={() => handleEdit(slot)}
                                    aria-label="Editar plantilla"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </ActionButton>
                                  <ActionButton
                                    tooltip="Duplicar"
                                    className="hidden lg:inline-flex"
                                    onClick={() => handleDuplicate(slot)}
                                    aria-label="Duplicar plantilla"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </ActionButton>
                                  <ActionButton
                                    tooltip="Eliminar"
                                    onClick={() => handleDelete(slot)}
                                    aria-label="Eliminar plantilla"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </ActionButton>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>👤 {getProfessionalNames(slot)}</p>
                                <p>⏱️ {slot.duration} min</p>
                                <p>👥 {getClientCount(slot)} clientes</p>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar clase?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClassSlotDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slot={selectedSlot}
        dayOfWeek={selectedDay}
        onSave={loadTemplateSlots}
        onDeleteRequest={(slot) => handleDelete(slot)}
      />
      <PropagateDialog
        open={propagateDialogOpen}
        onOpenChange={setPropagateDialogOpen}
        templateSlots={templateSlots}
        companyId={companyId || ''}
        onSuccess={() => {
          setShowSuccessAlert(true);
          setTimeout(() => setShowSuccessAlert(false), 5000);
        }}
      />

      {showSuccessAlert && (
        <div className="fixed bottom-4 right-4 z-50 w-96">
          <Alert className="border-green-500 bg-green-50 [&>svg]:top-3.5 [&>svg+div]:translate-y-0">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-start gap-2">
                <p className="font-semibold text-green-800">Clases propagadas correctamente</p>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
