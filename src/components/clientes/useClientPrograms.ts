import { useEffect, useRef, useState } from 'react';
import { error as logError } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { Cliente } from '@/types/cliente';

export type Program = any;

interface UseClientProgramsArgs {
  cliente?: Cliente | null;
  companyId?: string | null;
}

const clonePrograms = (items: Program[]): Program[] => JSON.parse(JSON.stringify(items || []));
const tempProgramId = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tempProgramExerciseId = () => `tpe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const exerciseIdOf = (pe: any) => pe?.exercise?.id ?? pe?.exercise ?? null;

// Normalize program exercises by compacting day letters to a contiguous sequence (A,B,C...)
export const normalizeProgramExercises = (peList: any[], existingDays?: string[]) => {
  const pe = Array.isArray(peList) ? peList : [];
  const presentDays = Array.from(new Set(pe.map((p) => String(p.day ?? 'A'))));
  let orderedPresentDays: string[] = [];
  if (presentDays.length === 0) {
    orderedPresentDays =
      Array.isArray(existingDays) && existingDays.length
        ? [...existingDays].sort((a: string, b: string) => a.charCodeAt(0) - b.charCodeAt(0))
        : ['A'];
  } else {
    // Force alphabetic ordering of present days to avoid edge cases with unordered letters
    orderedPresentDays = presentDays.sort(
      (a: string, b: string) => a.charCodeAt(0) - b.charCodeAt(0)
    );
  }

  const dayMap = new Map<string, string>();
  orderedPresentDays.forEach((old, idx) =>
    dayMap.set(old, String.fromCharCode('A'.charCodeAt(0) + idx))
  );

  const normalized: any[] = [];
  orderedPresentDays.forEach((oldDay) => {
    const newDay = dayMap.get(oldDay)!;
    const items = pe
      .filter((p) => String(p.day ?? 'A') === String(oldDay))
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
    items.forEach((it: any, idx: number) => {
      normalized.push({ ...it, position: idx, day: newDay });
    });
  });

  return {
    normalized,
    daysCompact: Array.from(dayMap.values()).length ? Array.from(dayMap.values()) : ['A'],
  };
};

export function useClientPrograms({ cliente, companyId }: UseClientProgramsArgs) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string>('');
  const [loadingProgramsList, setLoadingProgramsList] = useState(false);
  const [exercisesForCompany, setExercisesForCompany] = useState<any[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  // Lookup lists for anatomy/equipment (loaded when opening the picker)
  const [anatomyList, setAnatomyList] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [savedToastTitle, setSavedToastTitle] = useState<string | null>(null);
  const [persistingAll, setPersistingAll] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const initialProgramsRef = useRef<Program[]>([]);

  const setDefaultProgram = () => {
    const tempId = tempProgramId();
    const defaults = [
      {
        tempId,
        name: 'Programa 1',
        persisted: false,
        description: '',
        programExercises: [],
        days: ['A'],
      },
    ];
    setPrograms(defaults);
    setActiveProgramId(tempId);
    initialProgramsRef.current = clonePrograms(defaults);
    return defaults;
  };

  const hydratePrograms = (items: any[]) => {
    const hydrated = items.map((r: any) => ({
      ...r,
      persisted: true,
      programExercises: r.programExercises || [],
      days: (r.programExercises || []).length
        ? Array.from(new Set((r.programExercises || []).map((pe: any) => pe.day || 'A')))
        : r.days && r.days.length
          ? r.days
          : ['A'],
    }));
    return hydrated;
  };

  const loadPrograms = async (profileIdOverride?: string) => {
    setLoadingProgramsList(true);
    try {
      const profileId = profileIdOverride ?? cliente?.id;
      if (!profileId) {
        return setDefaultProgram();
      }

      const { data, error } = await supabase.from('programs').select('*').eq('profile', profileId);
      if (error) throw error;
      const items = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        persisted: true,
        description: r.description || '',
      }));

      if (!items.length) {
        return setDefaultProgram();
      }

      const progIds = items.map((it: any) => it.id);
      const { data: peData, error: peErr } = await supabase
        .from('program_exercises')
        .select('*, exercise:exercises(*)')
        .in('program', progIds);
      if (peErr) throw peErr;

      const map = new Map<string, any[]>();
      (peData || []).forEach((r: any) => {
        const arr = map.get(r.program) || [];
        arr.push(r);
        map.set(r.program, arr);
      });

      const withProgramExercises = items.map((it: any) => ({
        ...it,
        programExercises: map.get(it.id) || [],
      }));

      const hydrated = hydratePrograms(withProgramExercises);
      setPrograms(hydrated);
      setActiveProgramId((prev) => {
        if (prev && hydrated.some((p) => (p.id || p.tempId) === prev)) return prev;
        return hydrated[0]?.id ?? hydrated[0]?.tempId ?? '';
      });
      initialProgramsRef.current = clonePrograms(hydrated);
      return hydrated;
    } catch (e) {
      logError('Error loading programs', e);
      return setDefaultProgram();
    } finally {
      setLoadingProgramsList(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.id, companyId]);

  // Listen for exercise updates and reflect them in program_exercises and cached company exercises
  useEffect(() => {
    const handler = (e: any) => {
      const updated = e?.detail;
      if (!updated || !updated.id) return;

      // Update any program_exercises that reference this exercise
      setPrograms((prev) =>
        prev.map((pr) => ({
          ...pr,
          programExercises: (pr.programExercises || []).map((pe: any) =>
            pe.exercise && String(pe.exercise.id) === String(updated.id)
              ? { ...pe, exercise: { ...pe.exercise, ...updated } }
              : pe
          ),
        }))
      );

      // Update exercisesForCompany cache if present
      setExercisesForCompany((prev) =>
        (prev || []).map((ex: any) => (ex?.id === updated.id ? updated : ex))
      );
    };

    window.addEventListener('exercise-updated', handler as EventListener);
    return () => window.removeEventListener('exercise-updated', handler as EventListener);
  }, []);

  // Load anatomy and equipment lists early so program cards can render badges without opening the picker
  useEffect(() => {
    if (!companyId) {
      // ensure lists are cleared if no company available
      setAnatomyList([]);
      setEquipmentList([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [anatRes, equipRes] = await Promise.all([
          supabase.from('anatomy').select('*').eq('company', companyId).order('name'),
          supabase.from('equipment').select('*').eq('company', companyId).order('name'),
        ]);

        const anatomyData = (anatRes as any)?.data ?? anatRes;
        const equipmentData = (equipRes as any)?.data ?? equipRes;

        if (!cancelled) {
          setAnatomyList((anatomyData as any) || []);
          setEquipmentList((equipmentData as any) || []);
        }
      } catch (err) {
        logError('Error loading anatomy/equipment', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const markOrderUpdated = () => {
    setSavedToastTitle('Orden actualizado (pendiente de guardar)');
    setShowSavedToast(true);
    setHasPendingChanges(true);
    setTimeout(() => setShowSavedToast(false), 2600);
  };

  const notifySaved = (title: string) => {
    setSavedToastTitle(title);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2600);
  };

  const updateProgramExercisesPositions = async (programId: string, programExercises?: any[]) => {
    setPrograms((prev) =>
      prev.map((p) => {
        if ((p.id ?? p.tempId) !== programId) return p;
        const peList = programExercises ? [...programExercises] : [...(p.programExercises || [])];
        const { normalized, daysCompact } = normalizeProgramExercises(peList, p.days);
        return {
          ...p,
          programExercises: normalized,
          days: daysCompact,
        };
      })
    );
    markOrderUpdated();
  };

  // Persist normalized positions for a program's program_exercises in the DB
  const persistProgramExercisePositions = async (programKey: string) => {
    const program = programs.find((p) => (p.id ?? p.tempId) === programKey);
    if (!program) return;
    const programId = program.id ?? null;
    if (!programId) return; // nothing to persist for temp programs

    // Ensure we have latest normalized list
    const list = (program.programExercises || []).map((pe: any) => ({
      id: pe.id,
      position: pe.position ?? 0,
      day: pe.day ?? 'A',
    }));
    try {
      // Update all that have an id
      const updates = list
        .filter((pe: any) => pe.id)
        .map((pe: any) =>
          supabase
            .from('program_exercises')
            .update({ position: pe.position, day: pe.day })
            .eq('id', pe.id)
        );
      if (updates.length) {
        const results = await Promise.all(updates);
        for (const r of results) {
          if ((r as any).error) throw (r as any).error;
        }
      }
    } catch (err) {
      logError('Error persisting program_exercise positions', err);
      throw err;
    }
  };

  const addProgram = () => {
    const tempId = tempProgramId();
    const name = `Programa ${programs.length + 1}`;
    const t = {
      tempId,
      name,
      persisted: false,
      description: '',
      programExercises: [],
      days: ['A'],
    };
    setPrograms((prev) => [...prev, t]);
    setActiveProgramId(tempId);
    setHasPendingChanges(true);
  };

  const saveProgramName = async (idKey: string, newName: string) => {
    if (!newName || newName.trim() === '') {
      alert('El nombre no puede estar vacío');
      return;
    }
    setPrograms((prev) =>
      prev.map((t) => ((t.id ?? t.tempId) === idKey ? { ...t, name: newName } : t))
    );
    setHasPendingChanges(true);
  };

  const deleteProgram = async (idKey: string) => {
    setPrograms((prev) => {
      const filtered = prev.filter((t) => (t.id ?? t.tempId) !== idKey);
      const nextActive =
        activeProgramId === idKey
          ? (filtered[0]?.id ?? filtered[0]?.tempId ?? '')
          : activeProgramId;
      setActiveProgramId(nextActive);
      return filtered;
    });
    setHasPendingChanges(true);
  };

  // Delete a specific day from a program: remove the day and all associated program_exercises.
  // If the program is persisted (has a real id), also delete the rows in the DB immediately.
  const deleteDayFromProgram = async (programKey: string, day: string) => {
    try {
      // Only perform local removal; persistence should happen on global save
      setPrograms((prev) =>
        prev.map((pr) => {
          const key = pr.id ?? pr.tempId;
          if (key !== programKey) return pr;
          return {
            ...pr,
            days: (pr.days || []).filter((d: string) => d !== day),
            programExercises: (pr.programExercises || []).filter(
              (pe: any) => String(pe.day ?? 'A') !== String(day)
            ),
          };
        })
      );

      // Recompute positions and days for that program
      await updateProgramExercisesPositions(programKey);
    } catch (err) {
      logError('Error deleting day locally from program', err);
      throw err;
    }
  };

  const moveAssignmentUp = async (programId: string, day: string, peId: string) => {
    setPrograms((prev) =>
      prev.map((p) => {
        if ((p.id ?? p.tempId) !== programId) return p;
        const items = (p.programExercises || [])
          .filter((pe: any) => String(pe.day) === day)
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
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
      })
    );
    try {
      await updateProgramExercisesPositions(programId);
    } catch (err) {
      logError('Error normalizing after move up', err);
    }
  };

  const moveAssignmentDown = async (programId: string, day: string, peId: string) => {
    setPrograms((prev) =>
      prev.map((p) => {
        if ((p.id ?? p.tempId) !== programId) return p;
        const items = (p.programExercises || [])
          .filter((pe: any) => String(pe.day) === day)
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
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
      })
    );
    try {
      await updateProgramExercisesPositions(programId);
    } catch (err) {
      logError('Error normalizing after move down', err);
    }
  };

  const openAddExercises = async (_programId: string, _day?: string) => {
    try {
      if (!companyId) return;
      setExercisesLoading(true);
      const { data: exercisesData, error: exErr } = await supabase
        .from('exercises')
        .select('*')
        .eq('company', companyId)
        .order('name');
      if (exErr) throw exErr;

      // Also load anatomy and equipment lists so we can show their names instead of raw ids
      const [anatRes, equipRes] = await Promise.all([
        supabase.from('anatomy').select('*').eq('company', companyId).order('name'),
        supabase.from('equipment').select('*').eq('company', companyId).order('name'),
      ]);

      const anatomyData = (anatRes as any)?.data ?? (anatRes as any);
      const equipmentData = (equipRes as any)?.data ?? (equipRes as any);

      setExercisesForCompany((exercisesData as any) || []);
      setAnatomyList((anatomyData as any) || []);
      setEquipmentList((equipmentData as any) || []);

      return exercisesData || [];
    } catch (e) {
      logError('Error loading exercises for picker', e);
      setExercisesForCompany([]);
      setAnatomyList([]);
      setEquipmentList([]);
      return [];
    } finally {
      setExercisesLoading(false);
    }
  };

  const addExercisesToProgram = async (programId: string, exerciseIds: string[], day?: string) => {
    const resolvedDay = day ?? 'A';
    const lookups = new Map((exercisesForCompany || []).map((ex: any) => [ex.id, ex]));
    const additions = exerciseIds.map((exId, i) => {
      const exercise = lookups.get(exId) || { id: exId };
      return {
        tempId: tempProgramExerciseId(),
        program: programId,
        exercise,
        position: i,
        day: resolvedDay,
        // Default notes copied from the exercise description when available
        notes: exercise && exercise.description ? exercise.description : null,
        reps: null,
        sets: null,
        weight: null,
        secs: null,
      };
    });

    setPrograms((prev) =>
      prev.map((p) => {
        if ((p.id ?? p.tempId) !== programId) return p;
        const existing = p.programExercises || [];
        const currentForDay = existing.filter(
          (pe: any) => String(pe.day ?? 'A') === String(resolvedDay)
        );
        const start = currentForDay.length;
        const mapped = additions.map((a, idx) => ({ ...a, position: start + idx }));
        const nextDays = new Set([...(p.days || []), resolvedDay]);
        return { ...p, programExercises: [...existing, ...mapped], days: Array.from(nextDays) };
      })
    );
    await updateProgramExercisesPositions(programId);
  };

  const resetToInitial = () => {
    const clone = clonePrograms(initialProgramsRef.current);
    setPrograms(clone);
    setActiveProgramId(clone[0]?.id ?? clone[0]?.tempId ?? '');
    setHasPendingChanges(false);
  };

  const markCurrentAsClean = () => {
    initialProgramsRef.current = clonePrograms(programs);
    setHasPendingChanges(false);
  };

  const persistAll = async (profileId: string | null) => {
    if (!profileId) return;
    if (!companyId) {
      logError('No companyId available; skipping program persistence');
      throw new Error('missing_company_id');
    }

    setPersistingAll(true);
    try {
      const snapshot = clonePrograms(initialProgramsRef.current);
      const current = clonePrograms(programs);

      const existingPrograms = snapshot.filter((p) => p.id);
      const existingMap = new Map<string, any>(existingPrograms.map((p) => [p.id, p]));

      const currentIds = new Set(current.map((p) => p.id).filter(Boolean) as string[]);
      const programsToDelete = existingPrograms.filter((p) => !currentIds.has(p.id));
      if (programsToDelete.length) {
        const ids = programsToDelete.map((p) => p.id);
        await supabase.from('program_exercises').delete().in('program', ids);
        await supabase.from('programs').delete().in('id', ids);
      }

      const tempToReal = new Map<string, string>();

      for (const prog of current.filter((p) => !p.id)) {
        const { data, error } = await supabase
          .from('programs')
          .insert([
            {
              name: prog.name,
              profile: profileId,
              company: companyId,
              description: prog.description || '',
            },
          ])
          .select()
          .single();
        if (error) throw error;
        tempToReal.set(prog.tempId, data.id);
        prog.id = data.id;
        prog.persisted = true;
      }

      for (const prog of current.filter((p) => p.id)) {
        const initial = existingMap.get(prog.id);
        if (
          initial &&
          (initial.name !== prog.name || (initial.description || '') !== (prog.description || ''))
        ) {
          const { error } = await supabase
            .from('programs')
            .update({ name: prog.name, description: prog.description || '' })
            .eq('id', prog.id);
          if (error) throw error;
        }
      }

      const programIdFor = (p: any) => p.id ?? tempToReal.get(p.tempId);

      for (const prog of current) {
        const programId = programIdFor(prog);
        if (!programId) continue;

        const initialPeList = existingMap.get(programId)?.programExercises || [];
        const currentPeList = (prog.programExercises || []).map((pe: any) => ({
          ...pe,
          program: programId,
        }));

        // Compute only days that have exercises and remap them to a compact sequence (A,B,C...) to avoid gaps
        const { normalized } = normalizeProgramExercises(currentPeList, prog.days);

        const deletions = initialPeList.filter(
          (pe: any) => pe.id && !normalized.some((c: any) => c.id === pe.id)
        );
        if (deletions.length) {
          await supabase
            .from('program_exercises')
            .delete()
            .in(
              'id',
              deletions.map((d: any) => d.id)
            );
        }

        for (const pe of normalized) {
          if (!pe.id) continue;
          const initialPe = initialPeList.find((ipe: any) => ipe.id === pe.id);
          if (
            initialPe &&
            (exerciseIdOf(initialPe) !== exerciseIdOf(pe) ||
              String(initialPe.day ?? 'A') !== String(pe.day ?? 'A') ||
              (initialPe.position ?? 0) !== (pe.position ?? 0) ||
              (initialPe.notes ?? '') !== (pe.notes ?? '') ||
              (initialPe.reps ?? null) !== (pe.reps ?? null) ||
              (initialPe.sets ?? null) !== (pe.sets ?? null) ||
              (initialPe.weight ?? null) !== (pe.weight ?? null) ||
              (initialPe.secs ?? null) !== (pe.secs ?? null))
          ) {
            const { error } = await supabase
              .from('program_exercises')
              .update({
                exercise: exerciseIdOf(pe),
                day: pe.day ?? 'A',
                position: pe.position ?? 0,
                notes: pe.notes ?? null,
                reps: pe.reps ?? null,
                sets: pe.sets ?? null,
                weight: pe.weight ?? null,
                secs: pe.secs ?? null,
              })
              .eq('id', pe.id);
            if (error) throw error;
          }
        }

        const inserts = normalized.filter((pe: any) => !pe.id);
        if (inserts.length) {
          const payload = inserts.map((pe: any) => ({
            program: programId,
            exercise: exerciseIdOf(pe),
            position: pe.position ?? 0,
            day: pe.day ?? 'A',
            notes: pe.notes ?? null,
            reps: pe.reps ?? null,
            sets: pe.sets ?? null,
            weight: pe.weight ?? null,
            secs: pe.secs ?? null,
          }));
          const { data: insData, error: insErr } = await supabase
            .from('program_exercises')
            .insert(payload)
            .select('*, exercise:exercises(*)');
          if (insErr) throw insErr;
          inserts.forEach((pe: any, idx: number) => {
            pe.id = insData?.[idx]?.id;
          });
        }
      }

      const refreshed = await loadPrograms(profileId);
      initialProgramsRef.current = clonePrograms(refreshed || programs);
      // On success, clear pending flag
      setHasPendingChanges(false);
    } catch (e) {
      logError('Error persisting programs', e);
      alert('Error guardando programas: ' + String((e as any)?.message || e));
      throw e;
    } finally {
      setPersistingAll(false);
    }
  };

  const markPendingChanges = (flag: boolean) => setHasPendingChanges(Boolean(flag));

  // Persist a single program (create program row if needed, delete/insert/update its program_exercises)
  const persistProgram = async (programKey: string) => {
    const prog = programs.find((p) => (p.id ?? p.tempId) === programKey);
    if (!prog) return;
    if (!cliente?.id) throw new Error('missing_profile_id');
    if (!companyId) throw new Error('missing_company_id');

    try {
      // Ensure program exists in DB
      if (!prog.id) {
        const { data, error } = await supabase
          .from('programs')
          .insert([
            {
              name: prog.name,
              profile: cliente.id,
              company: companyId,
              description: prog.description || '',
            },
          ])
          .select()
          .single();
        if (error) throw error;
        prog.id = data.id;
        prog.persisted = true;
      }

      // Prepare normalized program exercises
      const programId = prog.id as string;
      const currentPeList = (prog.programExercises || []).map((pe: any) => ({ ...pe, program: programId }));
      const { normalized } = normalizeProgramExercises(currentPeList, prog.days);

      // Load initial snapshot for that program to compute deletions/updates
      const initialProgram = initialProgramsRef.current.find((p) => p.id === programId) || { programExercises: [] };
      const initialPeList = initialProgram.programExercises || [];

      // Deletions
      const deletions = initialPeList.filter((pe: any) => pe.id && !normalized.some((c: any) => c.id === pe.id));
      if (deletions.length) {
        await supabase.from('program_exercises').delete().in('id', deletions.map((d: any) => d.id));
      }

      // Updates
      for (const pe of normalized) {
        if (!pe.id) continue;
        const initialPe = initialPeList.find((ipe: any) => ipe.id === pe.id);
        if (
          initialPe &&
          (exerciseIdOf(initialPe) !== exerciseIdOf(pe) ||
            String(initialPe.day ?? 'A') !== String(pe.day ?? 'A') ||
            (initialPe.position ?? 0) !== (pe.position ?? 0) ||
            (initialPe.notes ?? '') !== (pe.notes ?? '') ||
            (initialPe.reps ?? null) !== (pe.reps ?? null) ||
            (initialPe.sets ?? null) !== (pe.sets ?? null) ||
            (initialPe.weight ?? null) !== (pe.weight ?? null) ||
            (initialPe.secs ?? null) !== (pe.secs ?? null))
        ) {
          const { error } = await supabase
            .from('program_exercises')
            .update({
              exercise: exerciseIdOf(pe),
              day: pe.day ?? 'A',
              position: pe.position ?? 0,
              notes: pe.notes ?? null,
              reps: pe.reps ?? null,
              sets: pe.sets ?? null,
              weight: pe.weight ?? null,
              secs: pe.secs ?? null,
            })
            .eq('id', pe.id);
          if (error) throw error;
        }
      }

      // Inserts
      const inserts = normalized.filter((pe: any) => !pe.id);
      if (inserts.length) {
        const payload = inserts.map((pe: any) => ({
          program: programId,
          exercise: exerciseIdOf(pe),
          position: pe.position ?? 0,
          day: pe.day ?? 'A',
          notes: pe.notes ?? null,
          reps: pe.reps ?? null,
          sets: pe.sets ?? null,
          weight: pe.weight ?? null,
          secs: pe.secs ?? null,
        }));
        const { data: insData, error: insErr } = await supabase
          .from('program_exercises')
          .insert(payload)
          .select('*, exercise:exercises(*)');
        if (insErr) throw insErr;
        inserts.forEach((pe: any, idx: number) => {
          pe.id = insData?.[idx]?.id;
        });
      }

      // Refresh the single program from DB to get canonical ids/ordering
      await loadPrograms(cliente.id);
      markCurrentAsClean();
    } catch (err) {
      logError('Error persisting program', err);
      throw err;
    }
  };

  return {
    programs,
    setPrograms,
    activeProgramId,
    setActiveProgramId,
    loadingProgramsList,
    addProgram,
    saveProgramName,
    deleteProgram,
    addExercisesToProgram,
    updateProgramExercisesPositions,
    moveAssignmentUp,
    moveAssignmentDown,
    openAddExercises,
    exercisesForCompany,
    exercisesLoading,
    anatomyList,
    equipmentList,
    showSavedToast,
    savedToastTitle,
    setShowSavedToast,
    persistAll,
    persistProgram,
    resetToInitial,
    markCurrentAsClean,
    loadPrograms,
    persistingAll,
    persistProgramExercisePositions,
    deleteDayFromProgram,
    notifySaved,
    // pending changes state
    hasPendingChanges,
    markPendingChanges,
  };
}
