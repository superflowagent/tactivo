import { useEffect, useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programExercise?: any | null;
  onSaved: (pe: any) => void;
}

export default function ProgramExerciseDialog({
  open,
  onOpenChange,
  programExercise,
  onSaved,
}: Props) {
  const [local, setLocal] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(programExercise ? { ...programExercise } : {});
  }, [programExercise]);

  const handleSave = async () => {
    if (!programExercise) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const updated = { ...programExercise, ...local };
      onSaved(updated);
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
          <DialogTitle>
            {programExercise?.id ? 'Editar ejercicio del programa' : 'Editar asignación'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Series</Label>
              <Input
                type="number"
                value={local.sets ?? ''}
                onChange={(e) =>
                  setLocal((s: any) => ({
                    ...s,
                    sets: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div>
              <Label>Repeticiones</Label>
              <Input
                type="number"
                value={local.reps ?? ''}
                onChange={(e) =>
                  setLocal((s: any) => ({
                    ...s,
                    reps: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                value={local.weight ?? ''}
                onChange={(e) =>
                  setLocal((s: any) => ({
                    ...s,
                    weight: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div>
              <Label>Tiempo (s)</Label>
              <Input
                type="number"
                value={local.secs ?? ''}
                onChange={(e) =>
                  setLocal((s: any) => ({
                    ...s,
                    secs: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Label>Notas</Label>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="text-muted-foreground cursor-default"
                      aria-label="Notas del ejercicio en el programa"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                    Modificar las notas del ejercicio en el programa no afectará a la descripción
                    original del ejercicio.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              value={local.notes ?? ''}
              onChange={(e) => setLocal((s: any) => ({ ...s, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="mr-2">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
