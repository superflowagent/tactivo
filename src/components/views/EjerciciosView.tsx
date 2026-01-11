import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, getFilePublicUrl } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import ActionButton from '@/components/ui/ActionButton';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DOMPurify from 'dompurify';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import ExerciseDialog from '@/components/ejercicios/ExerciseDialog';
import { ExerciseBadgeGroup } from '@/components/ejercicios/ExerciseBadgeGroup';
import { Pencil, Plus, ChevronDown, Trash, HelpCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizeForSearch } from "@/lib/stringUtils";

interface Exercise {
  id: string;
  name: string;
  description: string;
  file: string;
  company: string;
  equipment: string[];
  anatomy: string[];
  created: string;
  updated: string;
}

interface EquipmentRecord {
  id: string;
  name: string;
}

interface AnatomyRecord {
  id: string;
  name: string;
}

export function EjerciciosView() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [anatomy, setAnatomy] = useState<AnatomyRecord[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnatomy, setSelectedAnatomy] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [anatomyFilterQuery, setAnatomyFilterQuery] = useState('');
  const [equipmentFilterQuery, setEquipmentFilterQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  // Exercise deletion state
  const [exerciseDeleteOpen, setExerciseDeleteOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [exerciseDeleteLoading, setExerciseDeleteLoading] = useState(false);
  // Track pending uploads to display loaders on cards
  const [pendingUploads, setPendingUploads] = useState<Set<string>>(new Set());

  // Cargar ejercicios, anatomías y equipamiento
  const loadData = useCallback(async () => {
    if (!user?.company) return;

    try {
      setLoading(true);

      // Cargar ejercicios
      const { data: exercisesResult, error: exErr } = await supabase
        .from('exercises')
        .select('*')
        .eq('company', user.company)
        .order('name');
      if (exErr) throw exErr;
      setExercises((exercisesResult as Exercise[]) || []);

      // Cargar anatomías
      const { data: anatomyResult, error: anErr } = await supabase
        .from('anatomy')
        .select('*')
        .eq('company', user.company)
        .order('name');
      if (anErr) throw anErr;
      setAnatomy((anatomyResult as AnatomyRecord[]) || []);

      // Cargar equipamiento
      const { data: equipmentResult, error: eqErr } = await supabase
        .from('equipment')
        .select('*')
        .eq('company', user.company)
        .order('name');
      if (eqErr) throw eqErr;
      setEquipment((equipmentResult as EquipmentRecord[]) || []);
    } catch (err: any) {
      logError('Error loading exercises data:', err);
      alert('Error cargando datos de ejercicios: ' + (err?.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  }, [user?.company]);

  useEffect(() => {
    // Track timers to auto-clear pending uploads if no end event arrives
    const timers = new Map<string, number>();
    const startTimeoutMs = 3 * 60 * 1000; // 3 minutes

    const onStart = (e: any) => {
      const exId = e?.detail?.exerciseId;
      if (!exId) return;
      setPendingUploads((prev) => {
        const ns = new Set(prev);
        ns.add(exId);
        return ns;
      });
      // Reset any existing timeout for this exercise
      if (timers.has(exId)) {
        const old = timers.get(exId)!;
        clearTimeout(old);
      }
      const t = window.setTimeout(() => {
        setPendingUploads((prev) => {
          const ns = new Set(prev);
          ns.delete(exId);
          return ns;
        });
        console.warn('exercise-upload: timeout cleared for', exId);
      }, startTimeoutMs);
      timers.set(exId, t as unknown as number);
    };

    const onEnd = (e: any) => {
      const exId = e?.detail?.exerciseId;
      if (!exId) return;
      setPendingUploads((prev) => {
        const ns = new Set(prev);
        ns.delete(exId);
        return ns;
      });
      const t = timers.get(exId);
      if (t) {
        clearTimeout(t as unknown as number);
        timers.delete(exId);
      }
      if (e?.detail?.success) {
        // Refresh to pick up the updated file path
        loadData();
      }
    };

    window.addEventListener('exercise-upload-start', onStart as any);
    window.addEventListener('exercise-upload-end', onEnd as any);
    return () => {
      window.removeEventListener('exercise-upload-start', onStart as any);
      window.removeEventListener('exercise-upload-end', onEnd as any);
      // clear any remaining timers
      timers.forEach((t) => clearTimeout(t as unknown as number));
      timers.clear();
    };
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const requestDeleteExercise = (ex: Exercise) => {
    setExerciseToDelete(ex);
    setExerciseDeleteOpen(true);
  };

  const handleDeleteExerciseConfirm = async () => {
    if (!exerciseToDelete?.id) return;
    setExerciseDeleteLoading(true);
    try {
      const { error } = await supabase.from('exercises').delete().eq('id', exerciseToDelete.id);
      if (error) throw error;
      // Optionally delete associated file from storage
      try {
        if (exerciseToDelete.file) {
          const pathToRemove = exerciseToDelete.file.includes('/') ? exerciseToDelete.file : `${exerciseToDelete.id}/${exerciseToDelete.file}`;
          await supabase.storage.from('exercise_videos').remove([pathToRemove]);
        }
      } catch {
        /* ignore storage cleanup errors */
      }
      await loadData();
      setExerciseDeleteOpen(false);
      setExerciseToDelete(null);
    } catch (err) {
      logError('Error deleting exercise:', err);
      alert('Error al eliminar ejercicio');
    } finally {
      setExerciseDeleteLoading(false);
    }
  };



  // Delete equipment/anatomy via AlertDialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: 'equipment' | 'anatomy';
    name?: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const requestDeleteEquipment = (id: string, name?: string) => {
    setDeleteTarget({ id, type: 'equipment', name });
    setDeleteDialogOpen(true);
  };

  const requestDeleteAnatomy = (id: string, name?: string) => {
    setDeleteTarget({ id, type: 'anatomy', name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const collection = deleteTarget.type === 'equipment' ? 'equipment' : 'anatomy';
      const { error } = await supabase.from(collection).delete().eq('id', deleteTarget.id);
      if (error) throw error;

      if (deleteTarget.type === 'equipment') {
        setEquipment((prev) => prev.filter((x) => x.id !== deleteTarget.id));
        setSelectedEquipment((prev) => prev.filter((i) => i !== deleteTarget.id));
      } else {
        setAnatomy((prev) => prev.filter((x) => x.id !== deleteTarget.id));
        setSelectedAnatomy((prev) => prev.filter((i) => i !== deleteTarget.id));
      }

      await loadData();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      logError('Error deleting:', err);
      alert('Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isVideo = (file?: string) => {
    if (!file) return false;
    const lower = file.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
  };

  // Filtrar ejercicios basado en búsqueda y filtros seleccionados
  const filteredExercises = exercises.filter((exercise) => {
    // Filtro de búsqueda
    const matchesSearch =
      normalizeForSearch(exercise.name).includes(normalizeForSearch(searchTerm)) ||
      normalizeForSearch(exercise.description || '').includes(normalizeForSearch(searchTerm));

    if (!matchesSearch) return false;

    // Filtro de anatomía (OR logic - si hay seleccionadas)
    if (selectedAnatomy.length > 0) {
      const hasSelectedAnatomy = selectedAnatomy.some((id) => exercise.anatomy.includes(id));
      if (!hasSelectedAnatomy) return false;
    }

    // Filtro de equipamiento (OR logic - si hay seleccionadas)
    if (selectedEquipment.length > 0) {
      const hasSelectedEquipment = selectedEquipment.some((id) => exercise.equipment.includes(id));
      if (!hasSelectedEquipment) return false;
    }

    return true;
  });

  // Manejar cierre de diálogo
  const handleDialogClose = () => {
    setDialogOpen(false);
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Ejercicios</h1>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="w-full aspect-[9/16]" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mobile: Crear encima del searchbar */}
        <div className="w-full sm:hidden">
          <Button className="w-full mb-2" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-0 h-4 w-4" />
            Crear Ejercicio
          </Button>
        </div>

        {/* Search bar */}
        <Input
          placeholder="Buscar ejercicios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="section-search"
        />

        {/* On mobile: equip + anatomy occupy the same total width as the search */}
        <div className="w-full sm:w-auto flex gap-2">
          <div className="flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left text-sm">
                  <span>Equipamiento</span>
                  <div className="flex items-center gap-1">
                    {selectedEquipment.length > 0 && (
                      <span className="font-medium">{selectedEquipment.length}</span>
                    )}
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="popover-content-width" align="start">
                <div className="space-y-1">
                  <Input
                    placeholder="Buscar equipamiento..."
                    value={equipmentFilterQuery}
                    onChange={(e) => setEquipmentFilterQuery(e.target.value)}
                  />
                  <div
                    className="max-h-56 overflow-y-auto space-y-1"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {equipment
                      .filter((eq) =>
                        normalizeForSearch(eq.name).includes(
                          normalizeForSearch(equipmentFilterQuery)
                        )
                      )
                      .map((eq) => (
                        <label
                          key={eq.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedEquipment.includes(eq.id)}
                            onCheckedChange={(checked: boolean | 'indeterminate') => {
                              const isChecked = Boolean(checked);
                              if (isChecked) {
                                setSelectedEquipment([...selectedEquipment, eq.id]);
                              } else {
                                setSelectedEquipment(
                                  selectedEquipment.filter((id) => id !== eq.id)
                                );
                              }
                            }}
                          />
                          <span className="text-sm">{eq.name}</span>
                          <ActionButton
                            tooltip="Eliminar equipamiento"
                            className="ml-auto"
                            onClick={(evt) => {
                              evt.stopPropagation();
                              evt.preventDefault();
                              requestDeleteEquipment(eq.id, eq.name);
                            }}
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </ActionButton>
                        </label>
                      ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left text-sm">
                  <span>Anatomía</span>
                  <div className="flex items-center gap-1">
                    {selectedAnatomy.length > 0 && (
                      <span className="font-medium">{selectedAnatomy.length}</span>
                    )}
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="popover-content-width" align="start">
                <div className="space-y-1">
                  <Input
                    placeholder="Buscar anatomía..."
                    value={anatomyFilterQuery}
                    onChange={(e) => setAnatomyFilterQuery(e.target.value)}
                  />
                  <div
                    className="max-h-56 overflow-y-auto space-y-1"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {anatomy
                      .filter((a) =>
                        normalizeForSearch(a.name).includes(normalizeForSearch(anatomyFilterQuery))
                      )
                      .map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedAnatomy.includes(a.id)}
                            onCheckedChange={(checked: boolean | 'indeterminate') => {
                              const isChecked = Boolean(checked);
                              if (isChecked) {
                                setSelectedAnatomy([...selectedAnatomy, a.id]);
                              } else {
                                setSelectedAnatomy(selectedAnatomy.filter((id) => id !== a.id));
                              }
                            }}
                          />
                          <span className="text-sm">{a.name}</span>
                          <ActionButton
                            tooltip="Eliminar anatomía"
                            className="ml-auto"
                            onClick={(evt) => {
                              evt.stopPropagation();
                              evt.preventDefault();
                              requestDeleteAnatomy(a.id, a.name);
                            }}
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </ActionButton>
                        </label>
                      ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {(searchTerm || selectedAnatomy.length > 0 || selectedEquipment.length > 0) && (
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setSelectedAnatomy([]);
              setSelectedEquipment([]);
            }}
          >
            Limpiar
          </Button>
        )}
        <div className="flex-1" />

        {/* Desktop create button remains on the right */}
        <div className="hidden sm:block">
          <ExerciseDialog
            exercise={null}
            anatomy={anatomy}
            equipment={equipment}
            onSuccess={handleDialogClose}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            trigger={
              <Button className="whitespace-nowrap">
                <Plus className="mr-0 h-4 w-4" />
                Crear Ejercicio
              </Button>
            }
          />
        </div>
      </div>

      {/* Filtros aplicados */}
      {(selectedAnatomy.length > 0 || selectedEquipment.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          {selectedEquipment.map((id) => {
            const e = equipment.find((x) => x.id === id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="bg-blue-100 text-blue-800 border-blue-200"
              >
                {e?.name}
                <button
                  className="ml-1"
                  onClick={() => setSelectedEquipment(selectedEquipment.filter((i) => i !== id))}
                >
                  ×
                </button>
              </Badge>
            );
          })}
          {selectedAnatomy.map((id) => {
            const a = anatomy.find((x) => x.id === id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="bg-orange-100 text-orange-800 border-orange-200"
              >
                {a?.name}
                <button
                  className="ml-1"
                  onClick={() => setSelectedAnatomy(selectedAnatomy.filter((i) => i !== id))}
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog for equipment/anatomy */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'equipment'
                ? '¿Eliminar equipamiento?'
                : '¿Eliminar anatomía?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name
                ? `Vas a eliminar "${deleteTarget.name}". Esta acción no se puede deshacer.`
                : 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog for exercises (from cards) */}
      <AlertDialog open={exerciseDeleteOpen} onOpenChange={setExerciseDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ejercicio?</AlertDialogTitle>
            <AlertDialogDescription>
              {exerciseToDelete?.name
                ? `Vas a eliminar "${exerciseToDelete.name}". Esta acción no se puede deshacer.`
                : 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExerciseConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={exerciseDeleteLoading}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Resultados */}
      <div>
        <p className="text-sm text-slate-600 mb-4">
          {filteredExercises.length} ejercicio{filteredExercises.length !== 1 ? 's' : ''} encontrado
          {filteredExercises.length !== 1 ? 's' : ''}
        </p>
        {filteredExercises.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">
              No hay ejercicios que coincidan con los filtros
            </p>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredExercises.map((exercise) => {
              const exerciseAnatomy = anatomy.filter((a) => exercise.anatomy.includes(a.id));
              const exerciseEquipment = equipment.filter((e) => exercise.equipment.includes(e.id));

              return (
                <Card
                  key={exercise.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow h-48 sm:h-56 md:h-64 flex flex-col"
                >
                  {/* Card Header: Título, Edit Button y Badges */}
                  <CardHeader className="py-2 px-4 min-h-20">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{exercise.name}</span>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-muted-foreground cursor-default" aria-label="Descripción del ejercicio">
                                  <HelpCircle className="h-4 w-4" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                                <div className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words text-sm" dangerouslySetInnerHTML={{ __html: (exercise.description && String(exercise.description).trim()) ? DOMPurify.sanitize(exercise.description, { ALLOWED_TAGS: ['b','strong','i','em','ul','ol','li','br','p'], ALLOWED_ATTR: [] }) : 'Sin descripción' }} />
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardTitle>
                      <ExerciseDialog
                        exercise={exercise}
                        anatomy={anatomy}
                        equipment={equipment}
                        onSuccess={handleDialogClose}
                        trigger={
                          <ActionButton tooltip="Editar ejercicio" aria-label="Editar ejercicio">
                            <Pencil className="h-4 w-4" />
                          </ActionButton>
                        }
                      />

                      <ActionButton
                        tooltip="Eliminar ejercicio"
                        onClick={() => requestDeleteExercise(exercise)}
                        aria-label="Eliminar ejercicio"
                      >
                        <Trash className="h-4 w-4" />
                      </ActionButton>
                    </div>

                    {/* Badge Area with Overflow Tooltip */}
                    <div className="flex flex-col gap-1">
                      {exerciseEquipment.length > 0 && (
                        <ExerciseBadgeGroup items={exerciseEquipment} color="blue" maxVisible={2} />
                      )}
                      {exerciseAnatomy.length > 0 && (
                        <ExerciseBadgeGroup items={exerciseAnatomy} color="orange" maxVisible={2} />
                      )}
                    </div>
                  </CardHeader>

                  {/* Media Container */}
                  <div className="relative bg-slate-200 overflow-hidden aspect-video mt-auto group">
                    {pendingUploads.has(exercise.id) ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-r-transparent animate-spin" />
                          <p className="text-sm text-slate-400">Subiendo...</p>
                        </div>
                      </div>
                    ) : exercise.file ? (
                      <>
                        {isVideo(exercise.file) ? (
                          <video
                            src={
                              getFilePublicUrl('exercise_videos', exercise.id, exercise.file) ||
                              undefined
                            }
                            className="w-full h-full object-cover"
                            controls
                          />
                        ) : (
                          <img
                            src={
                              getFilePublicUrl('exercise_videos', exercise.id, exercise.file) ||
                              undefined
                            }
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Eliminado: botón eliminar sobre el video en hover */}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <p className="text-sm text-slate-400">Sin video</p>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
