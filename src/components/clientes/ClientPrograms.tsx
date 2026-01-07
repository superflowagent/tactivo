import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tabs as RadixTabs } from '@radix-ui/react-tabs';
import { Button } from '@/components/ui/button';
import { Trash, Plus, GripVertical, ArrowUp, ArrowDown, PencilLine } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import ActionButton from '@/components/ui/ActionButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
import ProgramExerciseDialog from '@/components/programs/ProgramExerciseDialog';
import { ExerciseBadgeGroup } from '@/components/ejercicios/ExerciseBadgeGroup';
import { useClientPrograms } from './useClientPrograms';
import type { Cliente } from '@/types/cliente';
import { getFilePublicUrl, supabase } from '@/lib/supabase';
import InviteToast from '@/components/InviteToast';
import { error as logError } from '@/lib/logger';

interface Props {
  cliente?: Cliente | null;
  companyId?: string | null;
  profileCreatedId?: string | null;
}

export default function ClientPrograms({ cliente, companyId }: Props) {
  const api = useClientPrograms({ cliente, companyId });

  // If the parent created a profile (new client saved), persist any pending programs
  React.useEffect(() => {
    // noop if there's nothing to do
  }, [cliente]);
  const {
    programs,
    setPrograms,
    activeProgramId,
    setActiveProgramId,
    loadingProgramsList,
    addProgram,
    saveProgramName,
    deleteProgram,
    addExercisesToProgram,
    openAddExercises,
    exercisesForCompany,
    exercisesLoading,
    updateProgramExercisesPositions,
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

  const [editingProgramExercise, setEditingProgramExercise] = useState<any | null>(null);
  const [showEditProgramExerciseDialog, setShowEditProgramExerciseDialog] = useState(false);

  const [showAddExercisesDialog, setShowAddExercisesDialog] = useState(false);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [currentProgramForPicker, setCurrentProgramForPicker] = useState<string | null>(null);
  const [currentDayForPicker, setCurrentDayForPicker] = useState<string | null>(null);

  const [anatomyForPicker, setAnatomyForPicker] = useState<any[]>([]);
  const [equipmentForPicker, setEquipmentForPicker] = useState<any[]>([]);

  const toggleSelectExercise = (id: string) => {
    setSelectedExerciseIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

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

  const handleDragStart = (ev: React.DragEvent, programId: string, peId: string) => {
    ev.dataTransfer?.setData('text', JSON.stringify({ programId, peId }));
    ev.dataTransfer?.setData('application/json', JSON.stringify({ programId, peId }));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-1 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <Tabs value={activeProgramId} onValueChange={setActiveProgramId}>
            <TabsList className="inline-flex items-center gap-2 overflow-x-auto overflow-y-hidden hide-scrollbar justify-start whitespace-nowrap">
              {programs.map((p) => {
                const idKey = p.id ?? p.tempId;
                return (
                  <div key={idKey} className="flex items-center gap-2">
                    <TabsTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 h-7 text-sm font-medium bg-transparent text-muted-foreground shadow-none border-0" value={idKey} onClick={(e) => { e.stopPropagation(); setActiveProgramId(idKey); }}>
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
                    </TabsTrigger>
                    <ActionButton className="h-6 w-6 p-0.5" aria-label="Eliminar programa" onClick={(e:any) => { e.stopPropagation(); setProgramToDeleteId(idKey); setShowDeleteProgramDialog(true); }}>
                      <Trash className="h-3 w-3" />
                    </ActionButton>
                  </div>
                );
              })}

              <div className="pl-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 h-7 text-sm font-medium bg-transparent text-muted-foreground shadow-none border-0 transition-colors hover:text-foreground hover:bg-[hsl(var(--background))]"
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

        <Tabs value={activeProgramId} onValueChange={setActiveProgramId} className="mt-4">
          {programs.map((p) => {
            const idKey = p.id ?? p.tempId;
            return (
              <TabsContent key={idKey} value={idKey} className="p-0 flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <Card className="p-4 space-y-4 h-full">
                    <div className="mt-2">
                      <LazyRichTextEditor
                        value={p.description || ''}
                        onChange={(val) => setPrograms((prev) => prev.map((x) => (x.id === p.id || x.tempId === p.tempId ? { ...x, description: val } : x)))}
                        placeholder="Descripción del programa"
                        className="min-h-[120px]"
                      />
                    </div>

                    {/* Program exercises */}
                    <div>
                      <div className="mt-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
                          {(p.days || ['A']).slice(0,7).map((day: string, di: number) => (
                            <div key={day} className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px]" onDragOver={(e) => { e.preventDefault(); }} onDrop={async (e) => {
                              e.preventDefault();
                              try {
                                const payload = e.dataTransfer?.getData('text') || e.dataTransfer?.getData('application/json');
                                if (!payload) return;
                                const parsed = JSON.parse(payload);
                                const peId = parsed.peId;
                                setPrograms((prev) => prev.map((prog) => {
                                  if ((prog.id || prog.tempId) !== (p.id || p.tempId)) return prog;
                                  const items = (prog.programExercises || []).map((it: any) => it.id === peId || it.tempId === peId ? { ...it, day } : it);
                                  return { ...prog, programExercises: items };
                                }));
                                if (peId && !String(peId).startsWith('tpe-')) {
                                  const { error } = await supabase.from('program_exercises').update({ day }).eq('id', peId);
                                  if (error) logError('Error updating day for program_exercise', error);
                                  const items = ((p.programExercises || []).filter((pe: any) => String(pe.day) === day));
                                  for (let i = 0; i < items.length; i++) {
                                    const pe = items[i];
                                    if (pe.id) {
                                      const { error } = await supabase.from('program_exercises').update({ position: i }).eq('id', pe.id);
                                      if (error) logError('Error updating position', error);
                                    }
                                  }
                                }
                              } catch (err) {
                                logError('Error handling drop', err);
                              }
                            }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium">{`Día ${day}`}</div>
                                <div>
                                  <ActionButton tooltip="Eliminar día" onClick={() => setPrograms((prev) => prev.map((pr) => pr.id === p.id || pr.tempId === p.tempId ? { ...pr, days: (pr.days || ['A']).filter((dd:string)=> dd !== day) } : pr))} aria-label="Eliminar día">
                                    <Trash className="h-4 w-4" />
                                  </ActionButton>
                                </div>
                              </div>
                              <div className="space-y-2 min-h-[40px]">
                                {(() => {
                                  const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                                  if (!items.length) {
                                    return (
                                      <div className="flex items-center justify-center py-6">
                                        <Button onClick={() => openAddExercisesDialog(p.id ?? p.tempId, day)} className="px-4 py-2">+ Ejercicio</Button>
                                      </div>
                                    );
                                  } else {
                                    return items.map((pe: any) => (
                                      <div key={pe.id || pe.tempId} draggable role="button" aria-grabbed="false" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); } }} onDragStart={(ev) => { ev.dataTransfer?.setData('text', JSON.stringify({ peId: pe.id || pe.tempId })); ev.dataTransfer?.setData('application/json', JSON.stringify({ peId: pe.id || pe.tempId })); }} onDragEnd={() => {}} onDragOver={(e) => e.preventDefault()} className={`p-2 bg-white rounded border flex items-center justify-between gap-2 transition-all duration-150 motion-safe:transform-gpu hover:scale-[1.01]`}>
                                        <div className="flex items-center gap-2">
                                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                          <div>
                                            <div className="text-sm font-medium">{pe.exercise?.name}</div>
                                            <div className="text-xs text-muted-foreground">{pe.exercise?.description}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{(pe.reps || pe.sets) ? `${pe.reps ?? '-'} x ${pe.sets ?? '-'}` : ''} {pe.weight ? `· ${pe.weight}kg` : ''} {pe.secs ? `· ${pe.secs}s` : ''}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button size="sm" variant="ghost" onClick={() => moveAssignmentUp(p.id ?? p.tempId, pe.day ?? 'A', pe.id ?? pe.tempId)} aria-label="Mover arriba"><ArrowUp className="h-4 w-4" /></Button>
                                          <Button size="sm" variant="ghost" onClick={() => moveAssignmentDown(p.id ?? p.tempId, pe.day ?? 'A', pe.id ?? pe.tempId)} aria-label="Mover abajo"><ArrowDown className="h-4 w-4" /></Button>
                                          <ActionButton tooltip="Editar asignación" onClick={() => { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); }} aria-label="Editar asignación">
                                            <PencilLine className="h-4 w-4" />
                                          </ActionButton>
                                          <ActionButton tooltip="Eliminar asignación" onClick={async () => {
                                            try {
                                              if (String(pe.tempId || '').startsWith('tpe-')) {
                                                setPrograms((prev) => prev.map((pr) => (pr.tempId === p.tempId ? { ...pr, programExercises: (pr.programExercises || []).filter((x: any) => x.tempId !== pe.tempId) } : pr)));
                                                return;
                                              }
                                              const { error } = await supabase.from('program_exercises').delete().eq('id', pe.id);
                                              if (error) throw error;
                                              setPrograms((prev) => prev.map((pr) => (pr.id === p.id ? { ...pr, programExercises: (pr.programExercises || []).filter((x: any) => x.id !== pe.id) } : pr)));
                                              await updateProgramExercisesPositions(p.id);
                                            } catch (err) {
                                              logError('Error deleting program_exercise', err);
                                              alert('Error eliminando asignación: ' + String(err));
                                            }
                                          }} aria-label="Eliminar asignación">
                                            <Trash className="h-4 w-4" />
                                          </ActionButton>
                                        </div>
                                      </div>
                                    ));
                                  }
                                })()}

                                {((p.days || []).length < 7) && (
                                  <Card className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px] flex items-center justify-center cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setPrograms(prev => prev.map(pr => pr.id === p.id ? { ...pr, days: [...(pr.days || ['A']), String.fromCharCode(((pr.days || ['A']).slice(-1)[0].charCodeAt(0) + 1))] } : pr))}>
                                    <div className="text-2xl font-bold">+</div>
                                  </Card>
                                )}
                              </div>
                            </div>
                          ))}
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
            setPrograms((prev) => prev.map((pr) => (pr.id === updated.program ? { ...pr, programExercises: (pr.programExercises || []).map((pe: any) => (pe.id === updated.id ? updated : pe)) } : pr)));
            try {
              updateProgramExercisesPositions(updated.program);
            } catch (err) {
              logError('Error normalizing after save', err);
            }
          }}
        />

        <Dialog open={showAddExercisesDialog} onOpenChange={setShowAddExercisesDialog}>
          <DialogContent className="max-w-6xl w-[95vw] h-[85vh]">
            <DialogHeader>
              <DialogTitle>Añadir ejercicios al programa</DialogTitle>
            </DialogHeader>

            {showSavedToast && savedToastTitle && (
              <InviteToast title={savedToastTitle} durationMs={2500} onClose={() => setShowSavedToast(false)} />
            )}

            <div className="p-2">
              {exercisesLoading ? (
                <div className="py-6 flex items-center justify-center">Cargando ejercicios...</div>
              ) : (
                <div className="h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {exercisesForCompany.map((ex) => {
                      const exerciseAnatomy = anatomyForPicker.filter((a:any) => (ex.anatomy || []).includes(a.id));
                      const exerciseEquipment = equipmentForPicker.filter((eq:any) => (ex.equipment || []).includes(eq.id));
                      const file = (ex.file as string | undefined) || undefined;
                      const isVideo = (file?: string) => { if (!file) return false; const lower = file.toLowerCase(); return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm'); };
                      const mediaUrl = file ? (getFilePublicUrl('exercise_videos', ex.id, file) || null) : null;

                      return (
                        <Card key={ex.id} className={cn('overflow-hidden transition-shadow hover:shadow-lg', selectedExerciseIds.has(ex.id) ? 'border-primary' : '')}>
                          <CardHeader className="py-2 px-3">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-medium text-sm line-clamp-2">{ex.name}</div>
                                  <Checkbox checked={selectedExerciseIds.has(ex.id)} onCheckedChange={() => toggleSelectExercise(ex.id)} />
                                </div>
                                <div className="mt-2">
                                  {exerciseEquipment.length > 0 && (<ExerciseBadgeGroup items={exerciseEquipment} color="blue" maxVisible={2} />)}
                                  {exerciseAnatomy.length > 0 && (<ExerciseBadgeGroup items={exerciseAnatomy} color="orange" maxVisible={2} />)}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <div className="relative bg-slate-100 overflow-hidden aspect-video">{mediaUrl ? (isVideo(file) ? (<video src={mediaUrl} className="w-full h-full object-cover" controls playsInline />) : (<img src={mediaUrl} alt={ex.name} className="w-full h-full object-cover" />)) : null}</div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end p-2">
              <Button variant="outline" onClick={() => setShowAddExercisesDialog(false)}>Cancelar</Button>
              <Button onClick={confirmAddExercises}>Añadir</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteProgramDialog} onOpenChange={setShowDeleteProgramDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar programa?</DialogTitle>
            </DialogHeader>
            <div className="p-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteProgramDialog(false)}>Cancelar</Button>
              <Button onClick={async () => { if (!programToDeleteId) return; await deleteProgram(programToDeleteId); setShowDeleteProgramDialog(false); setProgramToDeleteId(null); }}>Eliminar</Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
