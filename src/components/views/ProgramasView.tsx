import { useEffect, useState } from 'react';
import { ExerciseBadgeGroup } from '@/components/ejercicios/ExerciseBadgeGroup';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ExerciseBadgeGroup } from '@/components/ejercicios/ExerciseBadgeGroup';
import { Label } from '@/components/ui/label';
import { PencilLine, GripVertical, ArrowUp, ArrowDown, Trash, ChevronDown } from 'lucide-react';
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
    const [anatomyList, setAnatomyList] = useState<any[]>([]);
    const [equipmentList, setEquipmentList] = useState<any[]>([]);
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

                const items = (rows || []).map((r: any) => ({ id: r.id, name: r.name, description: r.description || '', company: r.company }));

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

    // Ensure anatomy/equipment lists are loaded when companyId becomes available so badges resolve on first render
    useEffect(() => {
        const loadLists = async () => {
            if (!companyId) return;
            try {
                const [anatRes, equipRes] = await Promise.all([
                    supabase.from('anatomy').select('*').eq('company', companyId).order('name'),
                    supabase.from('equipment').select('*').eq('company', companyId).order('name'),
                ]);
                setAnatomyList((anatRes as any)?.data ?? (anatRes as any) ?? []);
                setEquipmentList((equipRes as any)?.data ?? (equipRes as any) ?? []);
            } catch (err) {
                console.error('Error loading anatomy/equipment lists', err);
                setAnatomyList([]);
                setEquipmentList([]);
            }
        };
        loadLists();
    }, [companyId]);

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
                                                    <div className="text-sm text-muted-foreground">
                                                        <div className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{
                                                            __html: ((): string => {
                                                                const clean = DOMPurify.sanitize(String(p.description || 'Sin descripción'), { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'br', 'p'], ALLOWED_ATTR: [] });
                                                                return clean.replace(/<ol(\s|>)/gi, '<ol class="pl-5 list-decimal"$1').replace(/<ul(\s|>)/gi, '<ul class="pl-5 list-disc"$1');
                                                            })()
                                                        }} />
                                                    </div>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <div>
                                                <Label>Rutina semanal</Label>
                                                <div className="mt-2">


                                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
                                                        {(() => {
                                                            let daysArr: string[] = Array.isArray(p.days) && p.days.length
                                                                ? [...p.days]
                                                                : ((p.programExercises || []).length ? Array.from(new Set((p.programExercises || []).map((pe: any) => String(pe.day ?? 'A')))) : ['A']);
                                                            // Force alphabetical order (A,B,C...)
                                                            daysArr = daysArr.slice().sort((a: string, b: string) => a.charCodeAt(0) - b.charCodeAt(0));

                                                            return (
                                                                <>
                                                                    {daysArr.slice(0, 7).map((day: string, _di: number) => (
                                                                        <div key={day} className="border rounded-lg p-1 bg-muted/10 min-w-[120px] md:min-w-[90px]" onDragOver={(e) => { e.preventDefault(); }} onDrop={async (e) => {
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
                                                                            <div className="flex flex-wrap gap-3 min-h-[24px]">
                                                                                {(() => {
                                                                                    const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                                                                                    return (
                                                                                        <>
                                                                                            {items.map((pe: any) => (
                                                                                                <div key={pe.id || pe.tempId} draggable role="button" aria-grabbed="false" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); } }} onDragStart={(ev) => ev.dataTransfer?.setData('text', JSON.stringify({ programId: p.id, peId: pe.id ?? pe.tempId }))} onDragOver={(e) => e.preventDefault()} className="w-[240px] p-1 bg-white rounded-lg border flex flex-col gap-1 min-w-0 overflow-hidden">
                                                                                                    <div>
                                                                                                        <div className="text-sm font-medium truncate">{pe.exercise?.name}</div>
                                                                                                        <div className="text-xs text-muted-foreground max-h-[32px] overflow-hidden mt-0">{pe.exercise?.description}</div>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col gap-1">
                                                                                                        {(() => {
                                                                                                            const metrics: React.ReactNode[] = [];
                                                                                                            if (typeof pe.sets !== 'undefined' && pe.sets !== null && pe.sets !== '') {
                                                                                                                metrics.push(<div key="sets" className="flex items-center gap-1"><span className="text-muted-foreground">Series:</span> <span className="font-medium text-foreground">{pe.sets}</span></div>);
                                                                                                            }
                                                                                                            if (typeof pe.reps !== 'undefined' && pe.reps !== null && pe.reps !== '') {
                                                                                                                metrics.push(<div key="reps" className="flex items-center gap-2"><span className="text-muted-foreground">Reps:</span> <span className="font-medium text-foreground">{pe.reps}</span></div>);
                                                                                                            }
                                                                                                            if (typeof pe.weight !== 'undefined' && pe.weight !== null && pe.weight !== '') {
                                                                                                                metrics.push(<div key="weight" className="flex items-center gap-1"><span className="text-muted-foreground">kg:</span> <span className="font-medium text-foreground">{pe.weight}</span></div>);
                                                                                                            }
                                                                                                            if (typeof pe.secs !== 'undefined' && pe.secs !== null && pe.secs !== '') {
                                                                                                                metrics.push(<div key="secs" className="flex items-center gap-1"><span className="text-muted-foreground">Secs:</span> <span className="font-medium text-foreground">{pe.secs}</span></div>);
                                                                                                            }
                                                                                                            if (metrics.length === 0) return null;
                                                                                                            return (<div className="text-xs text-muted-foreground"><div className="flex items-center gap-2 whitespace-nowrap">{metrics}</div></div>);
                                                                                                        })()}
                                                                                                        {(() => {
                                                                                                            const exercise = pe.exercise || {};
                                                                                                            const anatomyIds = Array.isArray(exercise.anatomy) ? exercise.anatomy : [];
                                                                                                            const exerciseAnatomy = anatomyIds
                                                                                                                .map((a: any) => {
                                                                                                                    if (typeof a === 'object') return { id: String(a.id ?? a), name: String(a.name ?? a) };
                                                                                                                    const found = anatomyList.find((x: any) => String(x.id) === String(a));
                                                                                                                    return found ? { id: String(found.id), name: String(found.name) } : { id: String(a ?? ''), name: String(a ?? '') };
                                                                                                                })
                                                                                                                .filter((x: any) => x && x.name);

                                                                                                            const equipmentIds = Array.isArray(exercise.equipment) ? exercise.equipment : [];
                                                                                                            const exerciseEquipment = equipmentIds
                                                                                                                .map((eq: any) => {
                                                                                                                    if (typeof eq === 'object') return { id: String(eq.id ?? eq), name: String(eq.name ?? eq) };
                                                                                                                    const found = equipmentList.find((x: any) => String(x.id) === String(eq));
                                                                                                                    return found ? { id: String(found.id), name: String(found.name) } : { id: String(eq ?? ''), name: String(eq ?? '') };
                                                                                                                })
                                                                                                                .filter((x: any) => x && x.name);

                                                                                                            return (
                                                                                                                <div className="mt-0 min-h-[20px]">
                                                                                                                    {exerciseEquipment.length > 0 && <ExerciseBadgeGroup items={exerciseEquipment} color="blue" maxVisible={2} />}
                                                                                                                    {exerciseAnatomy.length > 0 && <ExerciseBadgeGroup items={exerciseAnatomy} color="orange" maxVisible={2} />}
                                                                                                                </div>
                                                                                                            );
                                                                                                        })()}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                            <div key="add-placeholder" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { /* same as onClick */ setCurrentProgramForPicker(p.id); setCurrentDayForPicker(day); (async () => { try { const { data } = await supabase.from('exercises').select('*').eq('company', p.company).order('name'); setExercisesForCompany((data as any) || []); setShowAddExercisesDialog(true); } catch (err) { console.error('Error loading exercises', err); } })(); } }} className="w-[240px] p-1 bg-white rounded-lg border flex flex-col items-center justify-center gap-1 min-w-0 cursor-pointer hover:shadow" onClick={async () => {
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
                                                                                                <div className="text-2xl opacity-40"><Plus /></div>
                                                                                                <div className="text-sm font-medium">Ejercicio</div>
                                                                                            </div>
                                                                                        </>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    ))}

                                                                    {daysArr.length < 7 && (
                                                                        <Card className="border rounded-lg p-1 bg-muted/10 min-w-[120px] md:min-w-[90px] flex items-center justify-center cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setPrograms(prev => prev.map(pr => pr.id === p.id ? { ...pr, days: [...(pr.days || ['A']), String.fromCharCode(((pr.days || ['A']).slice(-1)[0].charCodeAt(0) + 1))] } : pr))}>
                                                                            <div className="text-6xl font-bold opacity-40">+</div>
                                                                        </Card>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
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