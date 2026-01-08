import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash, Plus, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import ActionButton from '@/components/ui/ActionButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
import ProgramExerciseDialog from '@/components/programs/ProgramExerciseDialog';
import { ExerciseBadgeGroup } from '@/components/ejercicios/ExerciseBadgeGroup';
import type { useClientPrograms } from './useClientPrograms';
import { getFilePublicUrl } from '@/lib/supabase';
import InviteToast from '@/components/InviteToast';
import { error as logError } from '@/lib/logger';

type ClientProgramsApi = ReturnType<typeof useClientPrograms>;

interface Props {
  api: ClientProgramsApi;
}

export default function ClientPrograms({ api }: Props) {
  const {
    programs,
    setPrograms,
    activeProgramId,
    setActiveProgramId,
    addProgram,
    saveProgramName,
    deleteProgram,
    addExercisesToProgram,
    openAddExercises,
    exercisesForCompany,
    exercisesLoading,
    anatomyList,
    equipmentList,
    updateProgramExercisesPositions,
    persistProgramExercisePositions,
    moveAssignmentUp,
    moveAssignmentDown,
    showSavedToast,
    savedToastTitle,
    setShowSavedToast,
  } = api;

  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editingProgramName, setEditingProgramName] = useState<string>('');

  const [showDeleteProgramDialog, setShowDeleteProgramDialog] = useState(false);
  const [programToDeleteId, setProgramToDeleteId] = useState<string | null>(null);

  // Delete day dialog state
  const [showDeleteDayDialog, setShowDeleteDayDialog] = useState(false);
  const [programDayToDelete, setProgramDayToDelete] = useState<{ programKey: string; day: string } | null>(null);

  const [editingProgramExercise, setEditingProgramExercise] = useState<any | null>(null);
  const [showEditProgramExerciseDialog, setShowEditProgramExerciseDialog] = useState(false);

  const [showAddExercisesDialog, setShowAddExercisesDialog] = useState(false);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [currentProgramForPicker, setCurrentProgramForPicker] = useState<string | null>(null);
  const [currentDayForPicker, setCurrentDayForPicker] = useState<string | null>(null);

  // Drag & drop state
  const [draggedExercise, setDraggedExercise] = useState<{ peId: string; day: string; programId: string } | null>(null);
  const [dragOverExercise, setDragOverExercise] = useState<{ peId: string; day: string; programId: string } | null>(null);

  // Derive lookup lists for anatomy/equipment from loaded exercises to avoid undefined pickers
  const anatomyForPicker = React.useMemo(() => {
    const map = new Map<string, string>();
    // Prefer the fully loaded anatomy list (id -> name)
    (anatomyList || []).forEach((a: any) => {
      const id = String(a?.id ?? '');
      if (!id) return;
      const name = String(a?.name ?? id);
      map.set(id, name);
    });

    // Fallback: collect ids found on exercises and use any available name from the exercise object
    exercisesForCompany.forEach((ex: any) => {
      (ex?.anatomy || []).forEach((a: any) => {
        const id = String(a?.id ?? a ?? '');
        if (!id) return;
        if (!map.has(id)) {
          const name = String(a?.name ?? a ?? id);
          map.set(id, name);
        }
      });
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [exercisesForCompany, anatomyList]);

  const equipmentForPicker = React.useMemo(() => {
    const map = new Map<string, string>();
    // Prefer the fully loaded equipment list (id -> name)
    (equipmentList || []).forEach((eq: any) => {
      const id = String(eq?.id ?? '');
      if (!id) return;
      const name = String(eq?.name ?? id);
      map.set(id, name);
    });

    // Fallback: collect ids found on exercises and use any available name from the exercise object
    exercisesForCompany.forEach((ex: any) => {
      (ex?.equipment || []).forEach((eq: any) => {
        const id = String(eq?.id ?? eq ?? '');
        if (!id) return;
        if (!map.has(id)) {
          const name = String(eq?.name ?? eq ?? id);
          map.set(id, name);
        }
      });
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [exercisesForCompany, equipmentList]);


  const toggleSelectExercise = (id: string) => {
    setSelectedExerciseIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  // Track pending uploads so we can show a loader on cards when an exercise is uploading
  const [pendingUploads, setPendingUploads] = React.useState<Set<string>>(new Set());

  useEffect(() => {
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
      // Refresh exercises list if modal is open
      if (e?.detail?.success && showAddExercisesDialog) {
        // refresh the list
        openAddExercises(currentProgramForPicker ?? activeProgramId).catch(() => { });
      }
    };

    window.addEventListener('exercise-upload-start', onStart as any);
    window.addEventListener('exercise-upload-end', onEnd as any);
    return () => {
      window.removeEventListener('exercise-upload-start', onStart as any);
      window.removeEventListener('exercise-upload-end', onEnd as any);
      timers.forEach((t) => clearTimeout(t as unknown as number));
      timers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddExercisesDialog, currentProgramForPicker, activeProgramId]);

  const openAddExercisesDialog = async (programId: string, day?: string) => {
    setCurrentProgramForPicker(programId);
    setCurrentDayForPicker(day ?? null);
    setSelectedExerciseIds(new Set());
    setShowAddExercisesDialog(true);
    await openAddExercises(programId, day);
  };

  const confirmAddExercises = async () => {
    if (!currentProgramForPicker) return;
    const selected = Array.from(selectedExerciseIds);
    if (!selected.length) {
      setShowAddExercisesDialog(false);
      setCurrentProgramForPicker(null);
      setCurrentDayForPicker(null);
      return;
    }
    await addExercisesToProgram(currentProgramForPicker, selected, currentDayForPicker ?? 'A');
    setShowAddExercisesDialog(false);
    setCurrentProgramForPicker(null);
    setCurrentDayForPicker(null);
    setSelectedExerciseIds(new Set());
  };

  const handleDragStart = (e: React.DragEvent, peId: string, day: string, programId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedExercise({ peId, day, programId });
  };

  const handleDragOver = (e: React.DragEvent, peId: string, day: string, programId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedExercise && draggedExercise.peId !== peId) {
      setDragOverExercise({ peId, day, programId });
    }
  };

  const handleDrop = async (e: React.DragEvent, peId: string, day: string, programId: string) => {
    e.preventDefault();
    if (!draggedExercise || draggedExercise.peId === peId) {
      setDraggedExercise(null);
      setDragOverExercise(null);
      return;
    }

    const draggedProgramId = draggedExercise.programId;
    const draggedDay = draggedExercise.day;
    const draggedPeId = draggedExercise.peId;

    // Only allow reordering within the same day
    if (draggedDay !== day || draggedProgramId !== programId) {
      setDraggedExercise(null);
      setDragOverExercise(null);
      return;
    }

    // Get the program and items
    const program = programs.find((p) => (p.id ?? p.tempId) === programId);
    if (!program) return;

    const items = (program.programExercises || [])
      .filter((pe: any) => String(pe.day) === day)
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    const draggedIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === draggedPeId);
    const dropIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === peId);

    if (draggedIdx === -1 || dropIdx === -1) return;

    // Calculate the correct insertion position accounting for the removal
    let insertIdx = dropIdx;
    if (draggedIdx < dropIdx) {
      // If dragging from above, we need to adjust because removing shifts indices
      insertIdx = dropIdx - 1;
    }

    // Remove from original position and insert at new position
    const newItems = [...items];
    const draggedItem = newItems.splice(draggedIdx, 1)[0];
    newItems.splice(insertIdx, 0, draggedItem);

    // Update positions
    const merged = (program.programExercises || []).map((pe: any) => {
      const match = newItems.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
      return match ? { ...pe, position: newItems.indexOf(match) } : pe;
    });

    setPrograms((prev) =>
      prev.map((p) => ((p.id ?? p.tempId) === programId ? { ...p, programExercises: merged } : p)),
    );

    // Persist the changes
    try {
      await updateProgramExercisesPositions(programId);
    } catch (err) {
      logError('Error persisting exercise positions', err);
    }

    setDraggedExercise(null);
    setDragOverExercise(null);
  };

  const handleDragEnd = () => {
    setDraggedExercise(null);
    setDragOverExercise(null);
  };

  const handleDragOverColumn = (e: React.DragEvent, day: string, programId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToNewDay = async (e: React.DragEvent, targetDay: string, programId: string) => {
    e.preventDefault();
    if (!draggedExercise) {
      setDraggedExercise(null);
      setDragOverExercise(null);
      return;
    }

    const draggedProgramId = draggedExercise.programId;
    const draggedDay = draggedExercise.day;
    const draggedPeId = draggedExercise.peId;

    // If dropping in the same day, ignore
    if (draggedDay === targetDay && draggedProgramId === programId) {
      setDraggedExercise(null);
      setDragOverExercise(null);
      return;
    }

    // Only allow reordering within the same program
    if (draggedProgramId !== programId) {
      setDraggedExercise(null);
      setDragOverExercise(null);
      return;
    }

    // Get the program
    const program = programs.find((p) => (p.id ?? p.tempId) === programId);
    if (!program) return;

    // Determine insertion position in target day
    let insertPosition = 0;

    // If dragOverExercise is set and it's a real exercise (not __end__), insert before it
    if (dragOverExercise?.day === targetDay && dragOverExercise?.peId !== '__end__') {
      const targetDayItems = (program.programExercises || [])
        .filter((pe: any) => String(pe.day) === targetDay)
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

      const insertBeforeIdx = targetDayItems.findIndex((it: any) => (it.id ?? it.tempId) === dragOverExercise.peId);
      if (insertBeforeIdx !== -1) {
        insertPosition = insertBeforeIdx;
      } else {
        insertPosition = targetDayItems.length;
      }
    } else {
      // Insert at the end
      const targetDayItems = (program.programExercises || [])
        .filter((pe: any) => String(pe.day) === targetDay)
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
      insertPosition = targetDayItems.length;
    }

    // Build new programExercises array
    const merged = (program.programExercises || []).map((pe: any) => {
      if ((pe.id ?? pe.tempId) === draggedPeId) {
        // This will be handled separately
        return null;
      }
      return pe;
    }).filter(Boolean) as any[];

    // Insert the dragged item at the correct position in target day
    const targetDayItems = merged
      .filter((pe: any) => String(pe.day) === targetDay)
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    const draggedItem = (program.programExercises || []).find((pe: any) => (pe.id ?? pe.tempId) === draggedPeId);
    if (!draggedItem) return;

    // Create new dragged item with updated day and position
    const updatedDraggedItem = { ...draggedItem, day: targetDay, position: insertPosition };

    // Rebuild all items with correct positions
    const finalMerged = merged.map((pe: any) => {
      if (String(pe.day) === targetDay) {
        // In target day - adjust position if needed
        const currentPos = pe.position || 0;
        if (currentPos >= insertPosition) {
          return { ...pe, position: currentPos + 1 };
        }
      } else if (String(pe.day) === draggedDay) {
        // In source day - shift positions down for items after the dragged one
        const sourceDayItems = merged
          .filter((p: any) => String(p.day) === draggedDay)
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

        const draggedIdx = sourceDayItems.findIndex((p: any) => (p.id ?? p.tempId) === draggedPeId);
        const currentIdx = sourceDayItems.findIndex((p: any) => (p.id ?? p.tempId) === (pe.id ?? pe.tempId));

        if (draggedIdx !== -1 && currentIdx > draggedIdx) {
          return { ...pe, position: (pe.position || 0) - 1 };
        }
      }
      return pe;
    });

    // Add the dragged item back with new position
    finalMerged.push(updatedDraggedItem);

    setPrograms((prev) =>
      prev.map((p) => ((p.id ?? p.tempId) === programId ? { ...p, programExercises: finalMerged } : p)),
    );

    setDraggedExercise(null);
    setDragOverExercise(null);
  };

  const handleDragOverEnd = (e: React.DragEvent, day: string, programId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedExercise) {
      setDragOverExercise({ peId: '__end__', day, programId });
    }
  };

  const handleDropEnd = async (e: React.DragEvent, day: string, programId: string) => {
    e.preventDefault();
    if (!draggedExercise) {
      setDraggedExercise(null);
      setDragOverExercise(null);
      return;
    }

    const draggedProgramId = draggedExercise.programId;
    const draggedDay = draggedExercise.day;
    const draggedPeId = draggedExercise.peId;

    // Only allow reordering within the same day
    if (draggedDay !== day || draggedProgramId !== programId) {
      setDraggedExercise(null);
      setDragOverExercise(null);
      return;
    }

    // Get the program and items
    const program = programs.find((p) => (p.id ?? p.tempId) === programId);
    if (!program) return;

    const items = (program.programExercises || [])
      .filter((pe: any) => String(pe.day) === day)
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    const draggedIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === draggedPeId);
    if (draggedIdx === -1) return;

    // Move to the end
    const newItems = [...items];
    const draggedItem = newItems.splice(draggedIdx, 1)[0];
    newItems.push(draggedItem);

    // Update positions
    const merged = (program.programExercises || []).map((pe: any) => {
      const match = newItems.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
      return match ? { ...pe, position: newItems.indexOf(match) } : pe;
    });

    setPrograms((prev) =>
      prev.map((p) => ((p.id ?? p.tempId) === programId ? { ...p, programExercises: merged } : p)),
    );

    // Persist the changes
    try {
      await updateProgramExercisesPositions(programId);
    } catch (err) {
      logError('Error persisting exercise positions', err);
    }

    setDraggedExercise(null);
    setDragOverExercise(null);
  };

  const programTabTriggerClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 h-7 text-sm font-medium bg-transparent text-muted-foreground shadow-none border-0 cursor-pointer select-none";
  const dayColumnClass = "border rounded p-1 bg-muted/10 w-[240px]";
  const exerciseCardClass = "p-2 bg-white rounded border flex items-center justify-between gap-2 transition-shadow duration-150 hover:shadow-lg";
  const iconButtonClass = "h-4 w-4";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-1 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <Tabs value={activeProgramId} onValueChange={setActiveProgramId}>
            <TabsList className="inline-flex items-center gap-2 overflow-x-auto overflow-y-hidden hide-scrollbar justify-start whitespace-nowrap">
              {programs.map((p) => {
                const idKey = p.id ?? p.tempId;
                return (
                  <TabsTrigger key={idKey} value={idKey} asChild>
                    <div className={programTabTriggerClass} onClick={(e) => { e.stopPropagation(); setActiveProgramId(idKey); }}>
                      <div className="flex items-center gap-2">
                        {editingProgramId === idKey ? (
                          <input
                            autoFocus
                            className="text-sm rounded px-2 py-0.5 w-40"
                            value={editingProgramName}
                            onChange={(e) => setEditingProgramName(e.target.value)}
                            onBlur={async () => {
                              const newName = editingProgramName.trim();
                              setEditingProgramId(null);
                              setEditingProgramName('');
                              if (newName && newName !== p.name) {
                                await saveProgramName(idKey, newName);
                              } else if (!newName) {
                                alert('El nombre no puede estar vacío');
                              }
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              } else if (e.key === 'Escape') {
                                setEditingProgramId(null);
                                setEditingProgramName('');
                              }
                            }}
                          />
                        ) : (
                          <span className="text-sm" onDoubleClick={(e) => { e.stopPropagation(); setEditingProgramId(idKey); setEditingProgramName(p.name); }}>{p.name}</span>
                        )}
                        <ActionButton className="h-6 w-6 p-0.5" aria-label="Eliminar programa" onClick={(e: any) => { e.stopPropagation(); setProgramToDeleteId(idKey); setShowDeleteProgramDialog(true); }}>
                          <Trash className="h-3 w-3" />
                        </ActionButton>
                      </div>
                    </div>
                  </TabsTrigger>
                );
              })}

              <div className="pl-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className={cn(programTabTriggerClass, "transition-colors hover:text-foreground hover:bg-[hsl(var(--background))]")}
                        onClick={addProgram}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">Crear programa</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={activeProgramId} onValueChange={setActiveProgramId} className="mt-1">
          {programs.map((p) => {
            const idKey = p.id ?? p.tempId;
            return (
              <TabsContent key={idKey} value={idKey} className="!mt-0 p-0 flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <Card className="p-0 space-y-4 h-full">
                    <div className="px-4 pt-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-2 text-sm font-medium px-2 py-1 rounded hover:bg-muted/50 transition-colors">
                            Descripción
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[600px] p-3">
                          <LazyRichTextEditor
                            value={p.description || ''}
                            onChange={(val) => setPrograms((prev) => prev.map((x) => (x.id === p.id || x.tempId === p.tempId ? { ...x, description: val } : x)))}
                            placeholder="Descripción del programa"
                            className="min-h-[120px]"
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Program exercises */}
                    <div>
                      <div className="mt-1">
                        <div className="flex flex-wrap gap-4 px-4">
                          {(p.days || ['A']).slice(0, 7).map((day: string, _di: number) => {
                            const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                            return (
                              <div
                                key={day}
                                className={dayColumnClass}
                                onDragOver={(e) => handleDragOverColumn(e, day, p.id ?? p.tempId)}
                                onDrop={(e) => handleDropToNewDay(e, day, p.id ?? p.tempId)}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-medium pl-2">{`Día ${day}`}</div>
                                  <div>
                                    <ActionButton tooltip="Eliminar día" onClick={() => { setProgramDayToDelete({ programKey: p.id ?? p.tempId, day }); setShowDeleteDayDialog(true); }} aria-label="Eliminar día">
                                      <Trash className={iconButtonClass} />
                                    </ActionButton>
                                  </div>
                                </div>
                                <div className="space-y-2 min-h-[40px]">
                                  {items.length === 0 ? (
                                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">No hay ejercicios</div>
                                  ) : (
                                    items.map((pe: any, idx: number) => (
                                      <React.Fragment key={pe.id || pe.tempId}>
                                        {dragOverExercise?.peId === (pe.id ?? pe.tempId) && (
                                          <div className="h-0.5 bg-blue-500 my-1 rounded"></div>
                                        )}
                                        <div
                                          role="button"
                                          aria-grabbed={draggedExercise?.peId === (pe.id ?? pe.tempId) ? 'true' : 'false'}
                                          tabIndex={0}
                                          draggable
                                          onDragStart={(e) => handleDragStart(e, pe.id ?? pe.tempId, day, p.id ?? p.tempId)}
                                          onDragOver={(e) => handleDragOver(e, pe.id ?? pe.tempId, day, p.id ?? p.tempId)}
                                          onDrop={(e) => handleDrop(e, pe.id ?? pe.tempId, day, p.id ?? p.tempId)}
                                          onDragEnd={handleDragEnd}
                                          onKeyDown={(e) => { if (e.key === 'Enter') { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); } }}
                                          className={cn("overflow-hidden hover:shadow-lg transition-shadow flex flex-col bg-white rounded border cursor-move", draggedExercise?.peId === (pe.id ?? pe.tempId) && "opacity-50")}
                                        >
                                          {(() => {
                                            const exerciseAnatomy = anatomyForPicker.filter((a: any) => (pe.exercise?.anatomy || []).some((x: any) => String(x?.id ?? x ?? '') === a.id));
                                            const exerciseEquipment = equipmentForPicker.filter((eq: any) => (pe.exercise?.equipment || []).some((x: any) => String(x?.id ?? x ?? '') === eq.id));
                                            const file = (pe.exercise?.file as string | undefined) || undefined;
                                            const isVideo = (file?: string) => { if (!file) return false; const lower = file.toLowerCase(); return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm'); };
                                            const mediaUrl = file ? (getFilePublicUrl('exercise_videos', pe.exercise.id, file) || null) : null;

                                            return (
                                              <>
                                                <CardHeader className="py-2 px-4">
                                                  <div className="flex items-center justify-between gap-2">
                                                    <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">{pe.exercise?.name}</CardTitle>
                                                    <ActionButton
                                                      tooltip="Eliminar ejercicio"
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                          if (String(pe.tempId || '').startsWith('tpe-')) {
                                                            setPrograms((prev) => prev.map((pr) => (pr.tempId === p.tempId ? { ...pr, programExercises: (pr.programExercises || []).filter((x: any) => x.tempId !== pe.tempId) } : pr)));
                                                            await updateProgramExercisesPositions(p.id ?? p.tempId);
                                                            return;
                                                          }
                                                          setPrograms((prev) => prev.map((pr) => ((pr.id ?? pr.tempId) === (p.id ?? p.tempId) ? { ...pr, programExercises: (pr.programExercises || []).filter((x: any) => x.id !== pe.id) } : pr)));
                                                          await updateProgramExercisesPositions(p.id ?? p.tempId);
                                                        } catch (err) {
                                                          logError('Error deleting program_exercise', err);
                                                        }
                                                      }}
                                                      aria-label="Eliminar ejercicio"
                                                    >
                                                      <Trash className={iconButtonClass} />
                                                    </ActionButton>
                                                  </div>

                                                </CardHeader>

                                                <div className="relative bg-slate-200 overflow-hidden" style={{ height: '100px' }}>
                                                  {mediaUrl ? (
                                                    isVideo(file) ? (
                                                      <video src={mediaUrl} className="w-full h-full object-cover" controls playsInline />
                                                    ) : (
                                                      <img src={mediaUrl} alt={pe.exercise?.name} className="w-full h-full object-cover" />
                                                    )
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                                      <p className="text-sm text-slate-400">Sin video</p>
                                                    </div>
                                                  )}
                                                </div>

                                                <div className="px-1 py-3 border-t">
                                                  <div className="flex gap-1.5">
                                                    <div>
                                                      <label className="text-xs text-muted-foreground block mb-1 cursor-move">Series</label>
                                                      <Input
                                                        type="number"
                                                        value={pe.sets ?? ''}
                                                        onChange={(e) => {
                                                          const value = e.target.value ? parseInt(e.target.value) : null;
                                                          setPrograms((prev) => prev.map((pr) => {
                                                            if ((pr.id ?? pr.tempId) !== (p.id ?? p.tempId)) return pr;
                                                            return {
                                                              ...pr,
                                                              programExercises: (pr.programExercises || []).map((x: any) =>
                                                                (x.id ?? x.tempId) === (pe.id ?? pe.tempId) ? { ...x, sets: value } : x
                                                              )
                                                            };
                                                          }));
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        className="h-7 text-xs px-0.5 w-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        placeholder="0"
                                                      />
                                                    </div>
                                                    <div>
                                                      <label className="text-xs text-muted-foreground block mb-1 cursor-move">Reps</label>
                                                      <Input
                                                        type="number"
                                                        value={pe.reps ?? ''}
                                                        onChange={(e) => {
                                                          const value = e.target.value ? parseInt(e.target.value) : null;
                                                          setPrograms((prev) => prev.map((pr) => {
                                                            if ((pr.id ?? pr.tempId) !== (p.id ?? p.tempId)) return pr;
                                                            return {
                                                              ...pr,
                                                              programExercises: (pr.programExercises || []).map((x: any) =>
                                                                (x.id ?? x.tempId) === (pe.id ?? pe.tempId) ? { ...x, reps: value } : x
                                                              )
                                                            };
                                                          }));
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        className="h-7 text-xs px-0.5 w-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        placeholder="0"
                                                      />
                                                    </div>
                                                    <div>
                                                      <label className="text-xs text-muted-foreground block mb-1 cursor-move">Peso (kg)</label>
                                                      <Input
                                                        type="number"
                                                        value={pe.weight ?? ''}
                                                        onChange={(e) => {
                                                          const value = e.target.value ? parseFloat(e.target.value) : null;
                                                          setPrograms((prev) => prev.map((pr) => {
                                                            if ((pr.id ?? pr.tempId) !== (p.id ?? p.tempId)) return pr;
                                                            return {
                                                              ...pr,
                                                              programExercises: (pr.programExercises || []).map((x: any) =>
                                                                (x.id ?? x.tempId) === (pe.id ?? pe.tempId) ? { ...x, weight: value } : x
                                                              )
                                                            };
                                                          }));
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        className="h-7 text-xs px-0.5 w-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        placeholder="0"
                                                      />
                                                    </div>
                                                    <div>
                                                      <label className="text-xs text-muted-foreground block mb-1 cursor-move">Tiempo (s)</label>
                                                      <Input
                                                        type="number"
                                                        value={pe.secs ?? ''}
                                                        onChange={(e) => {
                                                          const value = e.target.value ? parseInt(e.target.value) : null;
                                                          setPrograms((prev) => prev.map((pr) => {
                                                            if ((pr.id ?? pr.tempId) !== (p.id ?? p.tempId)) return pr;
                                                            return {
                                                              ...pr,
                                                              programExercises: (pr.programExercises || []).map((x: any) =>
                                                                (x.id ?? x.tempId) === (pe.id ?? pe.tempId) ? { ...x, secs: value } : x
                                                              )
                                                            };
                                                          }));
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        className="h-7 text-xs px-0.5 w-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        placeholder="0"
                                                      />
                                                    </div>
                                                  </div>
                                                </div>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </React.Fragment>
                                    ))
                                  )}

                                  {dragOverExercise?.peId === '__end__' && dragOverExercise?.day === day && dragOverExercise?.programId === (p.id ?? p.tempId) && (
                                    <div className="h-0.5 bg-blue-500 my-1 rounded"></div>
                                  )}

                                  <div
                                    onDragOver={(e) => handleDragOverEnd(e, day, p.id ?? p.tempId)}
                                    onDrop={(e) => handleDropEnd(e, day, p.id ?? p.tempId)}
                                    onDragLeave={() => {
                                      if (dragOverExercise?.peId === '__end__' && dragOverExercise?.day === day) {
                                        setDragOverExercise(null);
                                      }
                                    }}
                                    className="min-h-[20px]"
                                  />

                                  <div className="flex items-center justify-center py-2">
                                    <Button variant="secondary" className="btn-propagate px-4 py-2" onClick={() => openAddExercisesDialog(p.id ?? p.tempId, day)}>
                                      <Plus className="mr-2 h-4 w-4" />
                                      Ejercicio
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {((p.days || []).length < 7) && (
                            <Card className={cn(dayColumnClass, "flex items-center justify-center cursor-pointer hover:bg-primary/10 hover:border-primary hover:shadow-lg hover:scale-[1.01] transition duration-150 motion-safe:transform-gpu")} onClick={() => setPrograms(prev => prev.map(pr => (pr.id ?? pr.tempId) === (p.id ?? p.tempId) ? { ...pr, days: [...(pr.days || ['A']), String.fromCharCode(((pr.days || ['A']).slice(-1)[0].charCodeAt(0) + 1))] } : pr))}>
                              <div className="text-6xl font-bold opacity-40">+</div>
                            </Card>
                          )}
                        </div>
                      </div>
                    </div>

                  </Card>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        <ProgramExerciseDialog
          open={showEditProgramExerciseDialog}
          onOpenChange={setShowEditProgramExerciseDialog}
          programExercise={editingProgramExercise}
          onSaved={(updated) => {
            if (!updated) return;
            const targetProgram = updated.program ?? editingProgramExercise?.program ?? activeProgramId;
            setPrograms((prev) => prev.map((pr) => {
              const key = pr.id ?? pr.tempId;
              if (key !== targetProgram) return pr;
              const list = (pr.programExercises || []).map((pe: any) => {
                const peKey = pe.id ?? pe.tempId;
                const updatedKey = updated.id ?? updated.tempId;
                return peKey === updatedKey ? { ...pe, ...updated } : pe;
              });
              return { ...pr, programExercises: list };
            }));
            updateProgramExercisesPositions(targetProgram).catch((err) => logError('Error normalizing after save', err));
          }}
        />

        <Dialog open={showAddExercisesDialog} onOpenChange={setShowAddExercisesDialog}>
          <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Añadir ejercicios al programa</DialogTitle>
              <DialogDescription>Selecciona ejercicios para añadir al programa</DialogDescription>
            </DialogHeader>

            {showSavedToast && savedToastTitle && (
              <InviteToast title={savedToastTitle} durationMs={2500} onClose={() => setShowSavedToast(false)} />
            )}

            <div className="flex-1 overflow-y-auto p-2">
              {exercisesLoading ? (
                <div className="py-6 flex items-center justify-center">Cargando ejercicios...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {exercisesForCompany.map((ex) => {
                    const exerciseAnatomy = anatomyForPicker.filter((a: any) => (ex.anatomy || []).some((x: any) => String(x?.id ?? x ?? '') === a.id));
                    const exerciseEquipment = equipmentForPicker.filter((eq: any) => (ex.equipment || []).some((x: any) => String(x?.id ?? x ?? '') === eq.id));
                    const file = (ex.file as string | undefined) || undefined;
                    const isVideo = (file?: string) => { if (!file) return false; const lower = file.toLowerCase(); return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm'); };
                    const mediaUrl = file ? (getFilePublicUrl('exercise_videos', ex.id, file) || null) : null;

                    return (
                      <Card
                        key={ex.id}
                        className={cn('overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer', selectedExerciseIds.has(ex.id) ? 'border-primary' : '')}
                        onClick={() => toggleSelectExercise(ex.id)}
                      >
                        <CardHeader className="py-2 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">{ex.name}</CardTitle>
                            <Checkbox
                              checked={selectedExerciseIds.has(ex.id)}
                              onCheckedChange={() => toggleSelectExercise(ex.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            {exerciseEquipment.length > 0 && (<ExerciseBadgeGroup items={exerciseEquipment} color="blue" maxVisible={2} />)}
                            {exerciseAnatomy.length > 0 && (<ExerciseBadgeGroup items={exerciseAnatomy} color="orange" maxVisible={2} />)}
                          </div>
                        </CardHeader>

                        <div
                          className="relative bg-slate-200 overflow-hidden aspect-video mt-auto group"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pendingUploads.has(ex.id) ? (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-r-transparent animate-spin" />
                                <p className="text-sm text-slate-400">Subiendo...</p>
                              </div>
                            </div>
                          ) : mediaUrl ? (
                            isVideo(file) ? (
                              <video src={mediaUrl} className="w-full h-full object-cover" controls playsInline />
                            ) : (
                              <img src={mediaUrl} alt={ex.name} className="w-full h-full object-cover" />
                            )
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

            <div className="flex gap-2 justify-end p-2 border-t">
              <Button variant="outline" onClick={() => setShowAddExercisesDialog(false)}>Cancelar</Button>
              <Button onClick={confirmAddExercises}>Añadir</Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteDayDialog} onOpenChange={setShowDeleteDayDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar día?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!programDayToDelete) return;
                  try {
                    await api.deleteDayFromProgram(programDayToDelete.programKey, programDayToDelete.day);
                    setShowDeleteDayDialog(false);
                    setProgramDayToDelete(null);
                  } catch (err) {
                    logError('Error deleting day via API', err);
                    alert('Error eliminando día');
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDeleteProgramDialog} onOpenChange={setShowDeleteProgramDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar programa?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!programToDeleteId) return;
                  await deleteProgram(programToDeleteId);
                  setShowDeleteProgramDialog(false);
                  setProgramToDeleteId(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}
