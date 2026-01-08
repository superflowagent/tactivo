import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dumbbell, PencilLine, GripVertical, ArrowUp, ArrowDown, Trash, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
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
    const [selectedExerciseId, _setSelectedExerciseId] = useState<string | null>(null);
    const [addingExerciseLoading, _setAddingExerciseLoading] = useState(false);
    const [currentProgramForPicker, setCurrentProgramForPicker] = useState<string | null>(null);
    const [currentDayForPicker, setCurrentDayForPicker] = useState<string | null>(null);

    // Reference unused variables to avoid linter warnings while the feature is present but dialog code is not mounted
    void showAddExercisesDialog;
    void exercisesForCompany;
    void selectedExerciseId;
    void addingExerciseLoading;
    void currentProgramForPicker;
    void currentDayForPicker;
    void _setSelectedExerciseId;
    void _setAddingExerciseLoading;

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
                    const { data, error } = await supabase.from('programs').select('*').eq('profile', profileId).order('name', { ascending: true });
                    if (error) throw error;
                    rows = data || [];
                } else {
                    // For non-clients, show company programs
                    const { data, error } = await supabase.from('programs').select('*').eq('company', companyId).order('name', { ascending: true });
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
                                            <TabsTrigger key={p.id} value={p.id} className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 h-7 text-sm font-medium bg-transparent text-muted-foreground shadow-none border-0">
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
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="flex items-center gap-2 text-sm font-medium px-2 py-1 rounded hover:bg-muted/50 transition-colors">
                                                        Descripción
                                                        <ChevronDown className="h-4 w-4" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-[500px] p-3">
                                                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.description || 'Sin descripción'}</div>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <div>
                                                <Label>Rutina semanal</Label>
                                                <div className="mt-2">


                                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
                                                        {(p.days || ['A']).slice(0, 7).map((day: string, _di: number) => (
                                                            <div key={day} className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px]" onDragOver={(e) => { e.preventDefault(); }} onDrop={async (e) => {
                                                                e.preventDefault();
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
                                                                        <ActionButton tooltip="Eliminar día" onClick={() => setPrograms((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, days: (pr.days || ['A']).filter((dd: string) => dd !== day) } : pr))} aria-label="Eliminar día">
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
                                                                                    <Button variant="secondary" className="btn-propagate px-4 py-2" onClick={async () => {
                                                                                        setCurrentProgramForPicker(p.id);
                                                                                        setCurrentDayForPicker(day);
                                                                                        try {
                                                                                            const { data } = await supabase.from('exercises').select('*').eq('company', p.company).order('name');
                                                                                            setExercisesForCompany((data as any) || []);
                                                                                            setShowAddExercisesDialog(true);
                                                                                        } catch (err) {
                                                                                            console.error('Error loading exercises', err);
                                                                                        }
                                                                                    }}>
                                                                                        <Plus className="mr-2 h-4 w-4" />
                                                                                        Ejercicio
                                                                                    </Button>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return items.map((pe: any) => (
                                                                            <div key={pe.id || pe.tempId} draggable role="button" aria-grabbed="false" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); } }} onDragStart={(ev) => ev.dataTransfer?.setData('text', JSON.stringify({ programId: p.id, peId: pe.id ?? pe.tempId }))} onDragOver={(e) => e.preventDefault()} className="p-2 bg-white rounded border flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div>
                                                                                        <div className="text-sm font-medium">{pe.exercise?.name}</div>
                                                                                        <div className="text-xs text-muted-foreground">{pe.exercise?.description}</div>
                                                                                        <div className="text-xs text-muted-foreground mt-1">{(pe.reps || pe.sets) ? `${pe.reps ?? '-'} x ${pe.sets ?? '-'}` : ''} {pe.weight ? `· ${pe.weight}kg` : ''} {pe.secs ? `· ${pe.secs}s` : ''}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                </div>
                                                                            </div>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {((p.days || []).length < 7) && (
                                                            <Card className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px] flex items-center justify-center cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setPrograms(prev => prev.map(pr => pr.id === p.id ? { ...pr, days: [...(pr.days || ['A']), String.fromCharCode(((pr.days || ['A']).slice(-1)[0].charCodeAt(0) + 1))] } : pr))}>
                                                                <div className="text-6xl font-bold opacity-40">+</div>
                                                            </Card>
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