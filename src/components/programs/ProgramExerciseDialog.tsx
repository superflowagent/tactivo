import { useEffect, useState } from 'react';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programExercise?: any | null;
    onSaved: (pe: any) => void;
}

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function ProgramExerciseDialog({ open, onOpenChange, programExercise, onSaved }: Props) {
    const [local, setLocal] = useState<any>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLocal(programExercise ? { ...programExercise, day: programExercise.day ?? 1 } : { day: 1 });
    }, [programExercise]);

    const handleSave = async () => {
        if (!programExercise) {
            onOpenChange(false);
            return;
        }
        setSaving(true);
        try {
            if (programExercise.id) {
                const updates = {
                    day: local.day ?? null,
                    position: local.position ?? null,
                    notes: local.notes ?? null,
                    reps: local.reps ?? null,
                    sets: local.sets ?? null,
                    weight: local.weight ?? null,
                    secs: local.secs ?? null,
                } as any;
                const { data, error } = await supabase.from('program_exercises').update(updates).eq('id', programExercise.id).select('*, exercise:exercises(*)').single();
                if (error) throw error;
                onSaved(data);
            } else {
                // local temp object: just forward the updated object
                onSaved(local);
            }
            onOpenChange(false);
        } catch (err) {
            console.error('Error saving program_exercise', err);
            alert('Error guardando asignación: ' + String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{programExercise?.id ? 'Editar ejercicio del programa' : 'Editar asignación'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Día</Label>
                        <select className="w-full p-2 border rounded" value={local.day} onChange={(e) => setLocal((s: any) => ({ ...s, day: Number(e.target.value) }))}>
                            {dayNames.map((d, i) => (
                                <option key={i} value={i + 1}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label>Reps</Label>
                            <Input type="number" value={local.reps ?? ''} onChange={(e) => setLocal((s: any) => ({ ...s, reps: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                        <div>
                            <Label>Sets</Label>
                            <Input type="number" value={local.sets ?? ''} onChange={(e) => setLocal((s: any) => ({ ...s, sets: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label>Weight</Label>
                            <Input type="number" value={local.weight ?? ''} onChange={(e) => setLocal((s: any) => ({ ...s, weight: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                        <div>
                            <Label>Secs</Label>
                            <Input type="number" value={local.secs ?? ''} onChange={(e) => setLocal((s: any) => ({ ...s, secs: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                    </div>

                    <div>
                        <Label>Notas</Label>
                        <Textarea value={local.notes ?? ''} onChange={(e) => setLocal((s: any) => ({ ...s, notes: e.target.value }))} />
                    </div>

                    <div className="flex justify-end">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="mr-2">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
