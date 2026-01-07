import { useEffect, useState } from 'react';
import { error as logError } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { Cliente } from '@/types/cliente';

export type Program = any;

interface UseClientProgramsArgs {
  cliente?: Cliente | null;
  companyId?: string | null;
}

export function useClientPrograms({ cliente, companyId }: UseClientProgramsArgs) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string>('');
  const [loadingProgramsList, setLoadingProgramsList] = useState(false);
  const [exercisesForCompany, setExercisesForCompany] = useState<any[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [savingProgram] = useState(false);
  const [savingPositions, setSavingPositions] = useState<Set<string>>(new Set());
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [savedToastTitle, setSavedToastTitle] = useState<string | null>(null);


  useEffect(() => {
    // auto-load programs when cliente changes
    if (cliente) loadPrograms();
    else {
      // new client: ensure default local program
      if (programs.length === 0) {
        const tempId = `t-${Date.now()}`;
        setPrograms([{ tempId, name: 'Programa 1', persisted: false, description: '', programExercises: [], days: ['A'] }]);
        setActiveProgramId(tempId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, companyId]);

  const loadPrograms = async () => {
    setLoadingProgramsList(true);
    try {
      if (!cliente?.id) return;
      const { data, error } = await supabase.from('programs').select('*').eq('profile', cliente.id);
      if (error) throw error;
      const items = (data || []).map((r: any) => ({ id: r.id, name: r.name, persisted: true, description: r.description || '' }));

      if (items.length) {
        try {
          const progIds = items.map((it: any) => it.id);
          const { data: peData, error: peErr } = await supabase.from('program_exercises').select('*, exercise:exercises(*)').in('program', progIds);
          if (peErr) throw peErr;
          const map = new Map<string, any[]>();
          (peData || []).forEach((r: any) => {
            const arr = map.get(r.program) || [];
            arr.push(r);
            map.set(r.program, arr);
          });
          const withProgramExercises = items.map((it: any) => {
            const peList = map.get(it.id) || [];
            return {
              ...it,
              programExercises: peList,
              days: peList.length ? Array.from(new Set(peList.map((pe: any) => pe.day || 'A'))) : ['A'],
            };
          });
          setPrograms(withProgramExercises);
          setActiveProgramId(withProgramExercises[0].id);
        } catch (err) {
          logError('Error loading program_exercises', err);
          setPrograms(items);
          setActiveProgramId(items[0].id);
        }
      } else {
        const tempId = `t-${Date.now()}`;
        setPrograms([{ tempId, name: 'Programa 1', persisted: false, description: '', programExercises: [], days: ['A'] }]);
        setActiveProgramId(tempId);
      }
    } catch (e) {
      logError('Error loading programs', e);
    } finally {
      setLoadingProgramsList(false);
    }
  };

  const addProgram = async () => {
    const nextIndex = programs.length + 1;
    const name = `Programa ${nextIndex}`;
    if (cliente?.id) {
      try {
        const { data, error } = await supabase.from('programs').insert([{ name, profile: cliente.id, company: companyId }]).select().single();
        if (error) throw error;
        setPrograms((prev) => [...prev, { id: data.id, name: data.name, persisted: true, description: '' }]);
        setActiveProgramId(data.id);
      } catch (e) {
        logError('Error creando programa', e);
        alert('Error creando programa: ' + String(e));
      }
    } else {
      const tempId = `t-${Date.now()}`;
      const t = { tempId, name, persisted: false, description: '', programExercises: [], days: ['A'] };
      setPrograms((prev) => [...prev, t]);
      setActiveProgramId(tempId);
    }
  };

  const persistSingleProgram = async (idKey: string) => {
    const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
    if (idx === -1) return null;
    const program = programs[idx];
    if (program.persisted && program.id) return program.id;
    if (!cliente?.id) return null;

    try {
      const { data, error } = await supabase.from('programs').insert([{ name: program.name, profile: cliente.id, company: companyId, description: program.description || '' }]).select().single();
      if (error) throw error;
      const persisted = { id: data.id, name: data.name, persisted: true, description: program.description || data.description || '' };
      setPrograms((prev) => prev.map((t, i) => (i === idx ? persisted : t)));
      if ((program.tempId && activeProgramId === program.tempId) || activeProgramId === program.id) {
        setActiveProgramId(data.id);
      }

      if (program.programExercises && program.programExercises.length && data.id) {
        try {
          const inserts = program.programExercises
            .filter((pe: any) => !pe.id)
            .map((pe: any, i: number) => ({
              program: data.id,
              exercise: pe.exercise?.id || pe.exercise,
              company: companyId,
              position: pe.position ?? i,
              day: pe.day ?? 'A',
              notes: pe.notes ?? null,
              reps: pe.reps ?? null,
              sets: pe.sets ?? null,
              weight: pe.weight ?? null,
              secs: pe.secs ?? null,
            }));
          if (inserts.length) {
            const { data: insData, error: insErr } = await supabase.from('program_exercises').insert(inserts).select('*, exercise:exercises(*)');
            if (insErr) logError('Error inserting program_exercises', insErr);
            if (insData && insData.length) {
              setPrograms((prev) => prev.map((t) => (t.id === data.id ? { ...t, programExercises: [...(t.programExercises || []), ...insData] } : t)));
            }
          }
        } catch (inner) {
          logError('Error inserting program_exercises for pending program', inner);
        }
      }

      return data.id;
    } catch (e) {
      logError('Error persisting single program', e);
      alert('Error guardando programa: ' + String(e));
      return null;
    }
  };

  const persistPendingPrograms = async (profileId: string | null) => {
    if (!profileId) return;
    const pending = programs.filter((t) => !t.persisted);
    if (pending.length === 0) return;
    try {
      const inserts = pending.map((t) => ({ name: t.name, profile: profileId, company: companyId, description: t.description || '' }));
      const { data, error } = await supabase.from('programs').insert(inserts).select();
      if (error) throw error;
      const persisted = data.map((d: any) => ({ id: d.id, name: d.name, persisted: true, description: d.description || '' }));

      try {
        for (let i = 0; i < persisted.length; i++) {
          const newProg = persisted[i];
          const originalPending = pending[i];
          const localPEs = originalPending?.programExercises || [];
          const insertsPE = localPEs.filter((pe: any) => !pe.id).map((pe: any, idx: number) => ({
            program: newProg.id,
            exercise: pe.exercise?.id || pe.exercise,
            company: companyId,
            position: pe.position ?? idx,
            day: pe.day ?? 'A',
            notes: pe.notes ?? null,
            reps: pe.reps ?? null,
            sets: pe.sets ?? null,
            weight: pe.weight ?? null,
            secs: pe.secs ?? null,
          }));
          if (insertsPE.length) {
            const { data: insData, error: insErr } = await supabase.from('program_exercises').insert(insertsPE).select('*, exercise:exercises(*)');
            if (insErr) logError('Error inserting program_exercises', insErr);
            if (insData && insData.length) {
              setPrograms((prev) => prev.map((t) => (t.id === newProg.id ? { ...t, programExercises: [...(t.programExercises || []), ...insData] } : t)));
            }
          }
        }
      } catch (inner) {
        logError('Error persisting program_exercises for pending programs', inner);
      }

      const kept = programs.filter((t) => t.persisted);
      setPrograms([...kept, ...persisted]);
      if (persisted.length && !kept.length) setActiveProgramId(persisted[0].id);
    } catch (e) {
      logError('Error persisting programs', e);
      alert('Error guardando programas: ' + String(e));
    }
  };

  const addExercisesToProgramDB = async (programId: string, exerciseIds: string[], day?: string) => {
    if (!companyId) return;
    if (!exerciseIds.length) return;
    const inserts = exerciseIds.map((exId) => ({ program: programId, exercise: exId, company: companyId, position: 999999, day: day ?? 'A' }));
    const { data, error } = await supabase.from('program_exercises').insert(inserts).select('*, exercise:exercises(*)');
    if (error) throw error;
    return data;
  };

  const updateProgramExercisesPositions = async (programId: string, programExercises?: any[]) => {
    let peList: any[];
    let daysForProgram: string[] = [];
    if (Array.isArray(programExercises)) {
      peList = programExercises;
    } else {
      const idx = programs.findIndex((t) => (t.id ?? t.tempId) === programId);
      if (idx === -1) return;
      peList = programs[idx].programExercises || [];
      daysForProgram = programs[idx].days || ['A'];
    }

    try {
      setSavingPositions((s) => new Set([...Array.from(s), programId]));
      const updates: Array<Promise<any>> = [];
      const daysList = daysForProgram.length ? daysForProgram : Array.from(new Set(peList.map((pe: any) => String(pe.day)))).sort();
      for (let di = 0; di < daysList.length; di++) {
        const day = daysList[di];
        const items = peList.filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
        for (let i = 0; i < items.length; i++) {
          const pe = items[i];
          const newPos = i;
          if (pe.position !== newPos) {
            pe.position = newPos;
            if (pe.id) {
              updates.push((async () => {
                const { error } = await supabase.from('program_exercises').update({ position: newPos, day }).eq('id', pe.id);
                if (error) logError('Error updating program_exercise position', error);
              })());
            }
          }
        }
      }
      if (updates.length) await Promise.all(updates);
      setPrograms((prev) => prev.map((p) => ((p.id === programId || p.tempId === programId) ? { ...p, programExercises: peList } : p)));

      setSavedToastTitle('Orden guardado');
      setShowSavedToast(true);
    } catch (err) {
      logError('Error updating program_exercises positions', err);
      setSavedToastTitle('Error guardando el orden');
      setShowSavedToast(true);
    } finally {
      setSavingPositions((s) => {
        const copy = new Set(Array.from(s));
        copy.delete(programId);
        return copy;
      });
      setTimeout(() => setShowSavedToast(false), 2600);
    }
  };

  const moveAssignmentUp = async (programId: string, day: string, peId: string) => {
    setPrograms((prev) => prev.map((p) => {
      if ((p.id ?? p.tempId) !== programId) return p;
      const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
      const idx = items.findIndex((it: any) => (it.id ?? it.tempId) === peId);
      if (idx > 0) {
        const newItems = [...items];
        [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
        const merged = (p.programExercises || []).map((pe: any) => {
          const match = newItems.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
          return match ? { ...pe, position: newItems.indexOf(match) } : pe;
        });
        return { ...p, programExercises: merged };
      }
      return p;
    }));
    try { await updateProgramExercisesPositions(programId); } catch (err) { logError('Error normalizing after move up', err); }
  };

  const moveAssignmentDown = async (programId: string, day: string, peId: string) => {
    setPrograms((prev) => prev.map((p) => {
      if ((p.id ?? p.tempId) !== programId) return p;
      const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
      const idx = items.findIndex((it: any) => (it.id ?? it.tempId) === peId);
      if (idx !== -1 && idx < items.length - 1) {
        const newItems = [...items];
        [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
        const merged = (p.programExercises || []).map((pe: any) => {
          const match = newItems.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
          return match ? { ...pe, position: newItems.indexOf(match) } : pe;
        });
        return { ...p, programExercises: merged };
      }
      return p;
    }));
    try { await updateProgramExercisesPositions(programId); } catch (err) { logError('Error normalizing after move down', err); }
  };

  const openAddExercises = async (_programId: string, _day?: string) => {
    try {
      if (!companyId) return;
      setExercisesLoading(true);
      const { data, error } = await supabase.from('exercises').select('*').eq('company', companyId).order('name');
      if (error) throw error;
      setExercisesForCompany((data as any) || []);
      return data || [];
    } catch (e) {
      logError('Error loading exercises for picker', e);
      setExercisesForCompany([]);
      return [];
    } finally {
      setExercisesLoading(false);
    }
  };

  const addExercisesToProgram = async (programId: string, exerciseIds: string[], day?: string) => {
    const inserted = await addExercisesToProgramDB(programId, exerciseIds, day);
    if (inserted) {
      setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, programExercises: [...(p.programExercises || []), ...inserted] } : p)));
      await updateProgramExercisesPositions(programId);
    }
  };

  return {
    programs,
    setPrograms,
    activeProgramId,
    setActiveProgramId,
    loadingProgramsList,
    addProgram,
    persistSingleProgram,
    persistPendingPrograms,
    saveProgramName: async (idKey: string, newName: string) => {
      if (!newName || newName.trim() === '') {
        alert('El nombre no puede estar vacío');
        return;
      }
      const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
      if (idx === -1) return;
      const program = programs[idx];
      if (program.persisted && program.id) {
        try {
          const { data, error } = await supabase.from('programs').update({ name: newName }).eq('id', program.id).select().single();
          if (error) throw error;
          setPrograms((prev) => prev.map((t, i) => (i === idx ? { ...t, name: data.name } : t)));
        } catch (e) {
          logError('Error renombrando programa', e);
          alert('Error al renombrar programa: ' + String(e));
        }
      } else {
        setPrograms((prev) => prev.map((t, i) => (i === idx ? { ...t, name: newName } : t)));
        if (cliente?.id) await persistSingleProgram(idKey);
      }
    },
    deleteProgram: async (idKey: string) => {
      const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
      if (idx === -1) return;
      const program = programs[idx];
      if (program.persisted && program.id) {
        try {
          const { error } = await supabase.from('programs').delete().eq('id', program.id);
          if (error) throw error;
          setPrograms((prev) => prev.filter((t, i) => i !== idx));
          if (activeProgramId === idKey) {
            const remaining = programs.filter((_, i) => i !== idx);
            if (remaining.length) setActiveProgramId(remaining[0].id ?? remaining[0].tempId);
            else setActiveProgramId('');
          }
        } catch (e) {
          logError('Error eliminando programa', e);
          alert('Error al eliminar programa: ' + String(e));
        }
      } else {
        setPrograms((prev) => prev.filter((t, i) => i !== idx));
        if (activeProgramId === idKey) {
          const remaining = programs.filter((_, i) => i !== idx);
          if (remaining.length) setActiveProgramId(remaining[0].id ?? remaining[0].tempId);
          else setActiveProgramId('');
        }
      }
    },
    addExercisesToProgramDB,
    addExercisesToProgram,
    updateProgramExercisesPositions,
    moveAssignmentUp,
    moveAssignmentDown,
    openAddExercises,
    exercisesForCompany,
    exercisesLoading,
    savingProgram,
    savingPositions,
    showSavedToast,
    savedToastTitle,
    setShowSavedToast,
  };
}
