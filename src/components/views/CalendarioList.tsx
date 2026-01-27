import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import ActionButton from '@/components/ui/ActionButton';
import { Trash } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { error as logError } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

type Props = {
  events: any[]; // esperados objetos transformados para FullCalendar (con start: Date, title, extendedProps, id)
  onRowClick?: (clickInfo: any) => void; // reusar handleEventClick pasando { event: { id } }
  onDeleteComplete?: () => void; // callback para recargar eventos
  canDelete?: boolean; // control para ocultar botón de eliminar (ej. clientes)
};

const PAGE_SIZE = 20;

export default function CalendarioList({
  events,
  onRowClick,
  onDeleteComplete,
  canDelete = true,
}: Props) {
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Solo eventos futuros
  const futureEvents = useMemo(() => {
    const now = new Date();
    return (events || []).filter((e) => {
      const start = e.start ? new Date(e.start) : new Date();
      return start >= now;
    });
  }, [events]);

  useEffect(() => {
    setPage(1); // resetear página cuando cambien los eventos/filtros
  }, [events]);

  const total = futureEvents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageItems = futureEvents.slice(startIdx, startIdx + PAGE_SIZE);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Keep selection in sync if events change (remove ids that no longer exist)
  useEffect(() => {
    setSelectedIds((s) => {
      const next = new Set(Array.from(s).filter((id) => futureEvents.some((e) => e.id === id)));
      return next;
    });
  }, [futureEvents]);

  const handleDeleteClick = (id: string) => {
    setEventToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    try {
      setDeleting(true);
      const { error: delErr } = await supabase.rpc('delete_event_json', {
        p_payload: { id: eventToDelete },
      });
      if (delErr) throw delErr;
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      setDeleting(false);
      onDeleteComplete && onDeleteComplete();
    } catch (err: any) {
      setDeleting(false);
      logError('Error al eliminar evento desde lista:', err);
      alert('Error al eliminar el evento: ' + (err?.message || 'Error desconocido'));
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setBulkDeleting(true);

      // Delete in parallel and collect results
      const results = await Promise.allSettled(
        ids.map((id) => supabase.rpc('delete_event_json', { p_payload: { id } }))
      );

      const failed = results.filter(
        (r: any) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)
      );
      if (failed.length > 0) {
        logError('Some deletions failed in bulk delete:', failed);
        alert('Algunos eventos no pudieron ser eliminados. Revisa la consola.');
      }

      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setBulkDeleting(false);
      onDeleteComplete && onDeleteComplete();
    } catch (err: any) {
      setBulkDeleting(false);
      logError('Error bulk deleting events:', err);
      alert('Error al eliminar eventos: ' + (err?.message || 'Error desconocido'));
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="min-h-0 flex flex-col h-full">
      <div className={`flex items-center justify-end ${selectedCount > 0 ? 'mt-3 mb-2' : 'mb-2'}`}>
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteDialogOpen(true)}
            aria-label={`Eliminar ${selectedCount} eventos seleccionados`}
          >
            Eliminar seleccionados ({selectedCount})
          </Button>
        )}
      </div>

      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                {canDelete
                  ? (() => {
                    const allSelected =
                      futureEvents.length > 0 && futureEvents.every((e) => selectedIds.has(e.id));
                    const someSelected = futureEvents.some((e) => selectedIds.has(e.id));

                    return (
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={(v) => {
                          // Select/deselect ALL events in the whole result set (not just page)
                          if (v) {
                            const toAdd = futureEvents.map((p) => p.id);
                            setSelectedIds(new Set(toAdd));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        disabled={futureEvents.length === 0}
                        aria-label="Seleccionar todos los eventos"
                      />
                    );
                  })()
                  : null}
              </TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Profesional(es)</TableHead>
              <TableHead>Cliente(s)</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((ev) => {
              const start = ev.start ? new Date(ev.start) : new Date();
              const dateStr = start.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              const timeStr = start.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const type = ev.extendedProps?.type || '';
              // Translate event type to Spanish for display
              const translatedType = type === 'class' ? 'clase' : type === 'appointment' ? 'cita' : type;
              const pros = ev.extendedProps?.professionalNames || '';
              const clients = ev.extendedProps?.clientNames || '';

              const isChecked = selectedIds.has(ev.id);

              return (
                <TableRow key={ev.id} className="hover:bg-muted">
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canDelete ? (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => {
                          setSelectedIds((s) => {
                            const next = new Set(s);
                            if (v) next.add(ev.id);
                            else next.delete(ev.id);
                            return next;
                          });
                        }}
                      />
                    ) : null}
                  </TableCell>

                  <TableCell
                    className="cursor-pointer"
                    onClick={() => onRowClick && onRowClick({ event: { id: ev.id } })}
                  >
                    {dateStr}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => onRowClick && onRowClick({ event: { id: ev.id } })}
                  >
                    {timeStr}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer capitalize"
                    onClick={() => onRowClick && onRowClick({ event: { id: ev.id } })}
                  >
                    {type}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer font-medium"
                    onClick={() => onRowClick && onRowClick({ event: { id: ev.id } })}
                  >
                    {ev.title}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => onRowClick && onRowClick({ event: { id: ev.id } })}
                  >
                    {pros}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => onRowClick && onRowClick({ event: { id: ev.id } })}
                  >
                    {clients}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      {canDelete && (
                        <ActionButton
                          tooltip="Eliminar"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(ev.id);
                          }}
                          aria-label="Eliminar evento"
                        >
                          <Trash className="h-4 w-4" />
                        </ActionButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No hay eventos futuros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {startIdx + 1} - {Math.min(startIdx + PAGE_SIZE, total)} de {total}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <div className="text-sm">
            Página {page} / {totalPages}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar eventos seleccionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {selectedCount} eventos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? 'Eliminando…' : `Eliminar (${selectedCount})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
