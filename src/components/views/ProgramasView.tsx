import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dumbbell, PencilLine, GripVertical, ArrowUp, ArrowDown, Trash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, fetchProfileByUserId } from '@/lib/supabase';
import ActionButton from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/button';
import ProgramExerciseDialog from '@/components/programs/ProgramExerciseDialog';

export function ProgramasView() {
    const { user, companyId } = useAuth();
    const [programs, setPrograms] = useState<any[]>([]);
    const [activeProgramId, setActiveProgramId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [editingProgramExercise, setEditingProgramExercise] = useState<any | null>(null);
    const [showEditProgramExerciseDialog, setShowEditProgramExerciseDialog] = useState(false);

    // Add exercises dialog state (for Programas view)
    const [showAddExercisesDialog, setShowAddExercisesDialog] = useState(false);
    const [exercisesForCompany, setExercisesForCompany] = useState<any[]>([]);
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    const [addingExerciseLoading, setAddingExerciseLoading] = useState(false);
    const [currentProgramForPicker, setCurrentProgramForPicker] = useState<string | null>(null);
    const [currentDayForPicker, setCurrentDayForPicker] = useState<string | null>(null);

    const updateProgramExercisesPositions = async (programId: string, programExercises?: any[]) => {
        let peList: any[];
        let daysForProgram: string[] = [];
        if (Array.isArray(programExercises)) {
            peList = programExercises;
        } else {
            const idx = programs.findIndex((t) => t.id === programId);
            if (idx === -1) return;
            peList = programs[idx].programExercises || [];
            daysForProgram = programs[idx].days || ['A'];
        }

        try {
            const updates: Array<Promise<any>> = [];
            const daysList = daysForProgram.length ? daysForProgram : Array.from(new Set(peList.map((pe: any) => String(pe.day)))).sort();
            for (let di = 0; di < daysList.length; di++) {
                const day = daysList[di];
                const items = peList.filter((pe: any) => String(pe.day) === day);
                for (let i = 0; i < items.length; i++) {
                    const pe = items[i];
                    const newPos = i;
                    if (pe.position !== newPos) {
                        pe.position = newPos;
                        if (pe.id) {
                            updates.push((async () => {
                                const { error } = await supabase.from('program_exercises').update({ position: newPos, day }).eq('id', pe.id);
                                if (error) console.error('Error updating program_exercise position', error);
                            })());
                        }
                    }
                }
            }
            if (updates.length) await Promise.all(updates);
            setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, programExercises: peList } : p)));
        } catch (err) {
            console.error('Error updating program_exercises positions', err);
        }
    };

    useEffect(() => {
        const loadPrograms = async () => {
            setLoading(true);
            try {
                if (!user) return;

                let rows: any[] = [];

                if (user.role === 'client') {
                    // Resolve the profile id for the current user and fetch programs where profile = profile.id
                    const profile = await fetchProfileByUserId(user.id);
                    const profileId = profile?.id ?? null;
                    if (!profileId) {
                        setPrograms([]);
                        return;
                    }
                    const { data, error } = await supabase.from('programs').select('*').eq('profile', profileId).order('name', {ascending: true});
                    if (error) throw error;
                    rows = data || [];
                } else {
                    // For non-clients, show company programs
                    const { data, error } = await supabase.from('programs').select('*').eq('company', companyId).order('name', {ascending: true});
                    if (error) throw error;
                    rows = data || [];
                }

                const items = (rows || []).map((r: any) => ({ id: r.id, name: r.name, description: r.description || '' }));

                if (items.length) {
                    // Attach exercises for each program
                    try {
                        const progIds = items.map((it: any) => it.id);
                        const { data: peData, error: peErr } = await supabase.from('program_exercises').select('*, exercise:exercises(*)').in('program', progIds);
                        if (peErr) throw peErr;
                        const map = new Map<string, any[]>();
                        (peData || []).forEach((r: any) => {
                            const arr = map.get(r.program) || [];
                            arr.push({
                                id: r.id,
                                program: r.program,
                                exercise: r.exercise,
                                position: r.position,
                                notes: r.notes,
                                day: r.day,
                                reps: r.reps,
                                sets: r.sets,
                                weight: r.weight,
                                secs: r.secs,
                                created_at: r.created_at,
                            });
                            map.set(r.program, arr);
                        });
                        const withExercises = items.map((it: any) => ({ ...it, programExercises: map.get(it.id) || [] }));
                        setPrograms(withExercises);
                        setActiveProgramId(withExercises[0]?.id ?? '');
                    } catch (err) {
                        console.error('Error loading program_exercises', err);
                        setPrograms(items);
                        setActiveProgramId(items[0]?.id ?? '');
                    }
                } else {
                    setPrograms([]);
                    setActiveProgramId('');
                }
            } catch (e) {
                console.error('Error loading programs', e);
                setPrograms([]);
                setActiveProgramId('');
            } finally {
                setLoading(false);
            }
        };

        loadPrograms();
    }, [user, companyId]);

    return (
        <div className="flex flex-1 flex-col gap-4 min-h-0">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        Programas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-sm text-muted-foreground">Cargando programas...</div>
                    ) : programs.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No hay programas disponibles</div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-2">
                                <Tabs value={activeProgramId} onValueChange={setActiveProgramId}>
                                    <TabsList className="inline-flex items-center gap-2 overflow-x-auto overflow-y-hidden hide-scrollbar justify-start whitespace-nowrap">
                                        {programs.map((p) => (
                                            <TabsTrigger key={p.id} value={p.id}>
                                                <span className="text-sm">{p.name}</span>
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                            </div>

                            <Tabs value={activeProgramId} onValueChange={setActiveProgramId} className="mt-4">
                                {programs.map((p) => (
                                    <TabsContent key={p.id} value={p.id} className="p-0">
                                        <Card className="p-4 space-y-4">
                                            <div className="mt-2">
                                                <Label>Descripción</Label>
                                                <Input value={p.description || ''} readOnly className="w-full bg-muted" />
                                            </div>

                                            <div>
                                                <Label>Rutina semanal</Label>
                                                <div className="mt-2">


                                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
                                                        {(p.days || ['A']).slice(0,7).map((day: string, di: number) => (
                                                            <div key={day} className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px]" onDragOver={(e) => { e.preventDefault(); }} onDrop={async (e) => {                                                                e.preventDefault();
                                                                try {
                                                                    const payload = e.dataTransfer?.getData('text') || e.dataTransfer?.getData('application/json');
                                                                    if (!payload) return;
                                                                    const parsed = JSON.parse(payload);
                                                                    const peId = parsed.peId;
                                                                    setPrograms((prev) => prev.map((prog) => {
                                                                        if (prog.id !== p.id) return prog;
                                                                        const items = (prog.programExercises || []).map((it: any) => it.id === peId || it.tempId === peId ? { ...it, day } : it);
                                                                        return { ...prog, programExercises: items };
                                                                    }));
                                                                    if (peId && !String(peId).startsWith('tpe-')) {
                                                                        const { error } = await supabase.from('program_exercises').update({ day }).eq('id', peId);
                                                                        if (error) console.error('Error updating day for program_exercise', error);
                                                                        // normalize positions for this program/day then persist
                                                                        const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day);
                                                                        for (let i = 0; i < items.length; i++) {
                                                                            const pe = items[i];
                                                                            if (pe.id) {
                                                                                const { error } = await supabase.from('program_exercises').update({ position: i }).eq('id', pe.id);
                                                                                if (error) console.error('Error updating position', error);
                                                                            }
                                                                        }
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Error handling drop', err);
                                                                }
                                                            }}>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                    <div className="text-sm font-medium">{`Día ${day}`}</div>
                                                                    <div>
                                                                        <ActionButton tooltip="Eliminar día" onClick={() => setPrograms((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, days: (pr.days || ['A']).filter((dd:string)=> dd !== day) } : pr))} aria-label="Eliminar día">
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
                                                                                    <Button onClick={async () => {
                                                                                        setCurrentProgramForPicker(p.id);
                                                                                        setCurrentDayForPicker(day);
                                                                                        try {
                                                                                            const { data } = await supabase.from('exercises').select('*').eq('company', p.company).order('name');
                                                                                            setExercisesForCompany((data as any) || []);
                                                                                            setShowAddExercisesDialog(true);
                                                                                        } catch (err) {
                                                                                            console.error('Error loading exercises', err);
                                                                                        }
                                                                                    }} className="px-4 py-2">+ Ejercicio</Button>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return items.map((pe: any) => (
                                                                            <div key={pe.id || pe.tempId} draggable role="button" aria-grabbed="false" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); } }} onDragStart={(ev) => ev.dataTransfer?.setData('text', JSON.stringify({ programId: p.id, peId: pe.id ?? pe.tempId }))} onDragOver={(e) => e.preventDefault()} className="p-2 bg-white rounded border flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                                                                    <div>
                                                                                        <div className="text-sm font-medium">{pe.exercise?.name}</div>
                                                                                        <div className="text-xs text-muted-foreground">{pe.exercise?.description}</div>
                                                                                        <div className="text-xs text-muted-foreground mt-1">{(pe.reps || pe.sets) ? `${pe.reps ?? '-'} x ${pe.sets ?? '-'}` : ''} {pe.weight ? `· ${pe.weight}kg` : ''} {pe.secs ? `· ${pe.secs}s` : ''}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <Button size="sm" variant="ghost" onClick={async () => { /* move up */ const items = (p.programExercises || []).filter((x:any)=>String(x.day)===day).sort((a:any,b:any)=> (a.position||0)-(b.position||0)); const idx = items.findIndex((it:any)=>(it.id??it.tempId)===(pe.id??pe.tempId)); if(idx>0){ const prev=items[idx-1]; setPrograms((prevP)=> prevP.map(pr=> pr.id===p.id?{...pr, programExercises: (pr.programExercises||[]).map((pe2: any) => { if((pe2.id??pe2.tempId)=== (prev.id??prev.tempId)) return {...pe2, position: idx}; if((pe2.id??pe2.tempId)=== (pe.id??pe.tempId)) return {...pe2, position: idx-1}; return pe2; })}:pr)); await updateProgramExercisesPositions(p.id);} }} aria-label="Mover arriba"><ArrowUp className="h-4 w-4" /></Button>
                                                                                    <Button size="sm" variant="ghost" onClick={async () => { /* move down */ const items = (p.programExercises || []).filter((x:any)=>String(x.day)===day).sort((a:any,b:any)=> (a.position||0)-(b.position||0)); const idx = items.findIndex((it:any)=>(it.id??it.tempId)===(pe.id??pe.tempId)); if(idx!==-1 && idx<items.length-1){ const next=items[idx+1]; setPrograms((prevP)=> prevP.map(pr=> pr.id===p.id?{...pr, programExercises: (pr.programExercises||[]).map((pe2: any) => { if((pe2.id??pe2.tempId)=== (next.id??next.tempId)) return {...pe2, position: idx}; if((pe2.id??pe2.tempId)=== (pe.id??pe.id??pe.tempId)) return {...pe2, position: idx+1}; return pe2; })}:pr)); await updateProgramExercisesPositions(p.id);} }} aria-label="Mover abajo"><ArrowDown className="h-4 w-4" /></Button>
                                                                                    <ActionButton tooltip="Editar asignación" onClick={() => { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); }} aria-label="Editar asignación">
                                                                                        <PencilLine className="h-4 w-4" />
                                                                                    </ActionButton>
                                                                                </div>
                                                                            </div>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {((p.days || []).length < 7) && (
                                                            <div className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px] flex items-center justify-center cursor-pointer" onClick={() => setPrograms(prev => prev.map(pr => pr.id === p.id ? { ...pr, days: [...(pr.days || ['A']), String.fromCharCode(((pr.days || ['A']).slice(-1)[0].charCodeAt(0) + 1))] } : pr))}>
                                                                <div className="text-2xl font-bold">+</div>
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>
                                        </Card>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </div>
                    )}
                </CardContent>
            </Card>

            <ProgramExerciseDialog
                open={showEditProgramExerciseDialog}
                onOpenChange={setShowEditProgramExerciseDialog}
                programExercise={editingProgramExercise}
                onSaved={(updated) => {
                    if (!updated) return;
                    setPrograms((prev) => prev.map((pr) => (pr.id === updated.program ? { ...pr, programExercises: (pr.programExercises || []).map((pe: any) => (pe.id === updated.id ? updated : pe)) } : pr)));
                }}
            />
        </div>
    );
}