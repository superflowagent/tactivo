import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash, Plus, ChevronDown, ArrowLeft, Pencil, HelpCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import ActionButton from '@/components/ui/ActionButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
import ProgramExerciseDialog from '@/components/programs/ProgramExerciseDialog';
import { ExerciseBadgeGroup } from '@/components/ejercicios/ExerciseBadgeGroup';
import type { useClientPrograms } from './useClientPrograms';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { getFilePublicUrl } from '@/lib/supabase';
import InviteToast from '@/components/InviteToast';
import { error as logError } from '@/lib/logger';
import { normalizeForSearch } from '@/lib/stringUtils';

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
    showSavedToast,
    savedToastTitle,
    setShowSavedToast,
  } = api;

  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editingProgramName, setEditingProgramName] = useState<string>('');

  // (Removed confirmation dialog) Delete day will be immediate in UI and persisted only when 'Guardar' is used

  const [editingProgramExercise, setEditingProgramExercise] = useState<any | null>(null);
  const [showEditProgramExerciseDialog, setShowEditProgramExerciseDialog] = useState(false);

  const [showAddExercisesDialog, setShowAddExercisesDialog] = useState(false);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [currentProgramForPicker, setCurrentProgramForPicker] = useState<string | null>(null);
  const [currentDayForPicker, setCurrentDayForPicker] = useState<string | null>(null);

  // Filter states for add exercises dialog
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [selectedFilterAnatomy, setSelectedFilterAnatomy] = useState<string[]>([]);
  const [selectedFilterEquipment, setSelectedFilterEquipment] = useState<string[]>([]);
  const [anatomyFilterQuery, setAnatomyFilterQuery] = useState('');
  const [equipmentFilterQuery, setEquipmentFilterQuery] = useState('');

  // UI: list vs opened program view
  const [viewingProgramId, setViewingProgramId] = useState<string | null>(null);

  // ===== DRAG & DROP STATE =====
  // Optimized drag & drop implementation with:
  // - useCallback for all handlers to prevent unnecessary re-renders
  // - requestAnimationFrame to throttle dragover events and prevent layout thrashing
  // - Refs to access latest drag state without triggering re-renders
  // - Blue indicator bar shows drop position (maintained from original design)

  const [draggedExercise, setDraggedExercise] = useState<{
    peId: string;
    day: string;
    programId: string;
  } | null>(null);
  const [dragOverExercise, setDragOverExercise] = useState<{
    peId: string;
    day: string;
    programId: string;
  } | null>(null);
  // Column (day) drag & drop state
  const [draggedDayColumn, setDraggedDayColumn] = useState<{
    day: string;
    programId: string;
  } | null>(null);
  const [dragOverDayColumn, setDragOverDayColumn] = useState<{
    day: string;
    programId: string;
  } | null>(null);
  const [dragOverDayColumnSide, setDragOverDayColumnSide] = useState<'top' | 'bottom' | null>(null);

  // Refs to reduce reflow and re-render during dragover events (throttled with rAF)
  const draggedExerciseRef = useRef(draggedExercise);
  React.useEffect(() => {
    draggedExerciseRef.current = draggedExercise;
  }, [draggedExercise]);

  const draggedDayColumnRef = useRef(draggedDayColumn);
  React.useEffect(() => {
    draggedDayColumnRef.current = draggedDayColumn;
  }, [draggedDayColumn]);

  // Store programs in a ref to avoid recreating handlers on every programs change
  const programsRef = useRef(programs);
  React.useEffect(() => {
    programsRef.current = programs;
  }, [programs]);

  const dragOverRafRef = useRef<number | null>(null);
  const pendingDragOverRef = useRef<{ peId: string; day: string; programId: string } | null>(null);

  const dragOverColumnRafRef = useRef<number | null>(null);
  const pendingDragOverColumnRef = useRef<{
    day: string;
    programId: string;
    pointerY?: number;
    target?: HTMLElement | null;
  } | null>(null);

  React.useEffect(() => {
    return () => {
      if (dragOverRafRef.current) cancelAnimationFrame(dragOverRafRef.current);
      if (dragOverColumnRafRef.current) cancelAnimationFrame(dragOverColumnRafRef.current);
    };
  }, []);

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
        openAddExercises(currentProgramForPicker ?? activeProgramId).catch(() => {});
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
    // Reset filters when opening dialog
    setExerciseSearchTerm('');
    setSelectedFilterAnatomy([]);
    setSelectedFilterEquipment([]);
    setAnatomyFilterQuery('');
    setEquipmentFilterQuery('');
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

  // Filter exercises based on search term and selected anatomy/equipment
  const filteredExercisesForDialog = useMemo(() => {
    return exercisesForCompany.filter((exercise: any) => {
      // Filtro de búsqueda
      const matchesSearch =
        normalizeForSearch(exercise.name).includes(normalizeForSearch(exerciseSearchTerm)) ||
        normalizeForSearch(exercise.description || '').includes(
          normalizeForSearch(exerciseSearchTerm)
        );

      if (!matchesSearch) return false;

      // Filtro de anatomía (OR logic - si hay seleccionadas)
      if (selectedFilterAnatomy.length > 0) {
        const hasSelectedAnatomy = selectedFilterAnatomy.some((id) =>
          (exercise.anatomy || []).some((x: any) => String(x?.id ?? x ?? '') === id)
        );
        if (!hasSelectedAnatomy) return false;
      }

      // Filtro de equipamiento (OR logic - si hay seleccionadas)
      if (selectedFilterEquipment.length > 0) {
        const hasSelectedEquipment = selectedFilterEquipment.some((id) =>
          (exercise.equipment || []).some((x: any) => String(x?.id ?? x ?? '') === id)
        );
        if (!hasSelectedEquipment) return false;
      }

      return true;
    });
  }, [exercisesForCompany, exerciseSearchTerm, selectedFilterAnatomy, selectedFilterEquipment]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, peId: string, day: string, programId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      // Update ref synchronously so immediate dragover events see the current dragged item
      draggedExerciseRef.current = { peId, day, programId };
      setDraggedExercise({ peId, day, programId });
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, peId: string, day: string, programId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // Defer work to rAF to avoid layout thrash / excessive re-renders
      pendingDragOverRef.current = { peId, day, programId };
      if (dragOverRafRef.current != null) return;
      dragOverRafRef.current = requestAnimationFrame(() => {
        dragOverRafRef.current = null;
        const args = pendingDragOverRef.current;
        pendingDragOverRef.current = null;
        const d = draggedExerciseRef.current;

        // If no dragged item or dragging within same program but different exercise, show indicator
        if (!d) {
          setDragOverExercise(null);
          return;
        }

        // Only show drop indicator if dragging to a different exercise within the same program
        if (d.peId !== args!.peId && d.programId === args!.programId) {
          setDragOverExercise({ peId: args!.peId, day: args!.day, programId: args!.programId });
        } else {
          setDragOverExercise(null);
        }
      });
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, peId: string, day: string, programId: string) => {
      e.preventDefault();
      if (!draggedExercise || draggedExercise.peId === peId) {
        setDraggedExercise(null);
        setDragOverExercise(null);
        return;
      }

      const draggedProgramId = draggedExercise.programId;
      const draggedPeId = draggedExercise.peId;

      // Only allow reordering within the same program
      if (draggedProgramId !== programId) {
        setDraggedExercise(null);
        setDragOverExercise(null);
        return;
      }

      setPrograms((prevPrograms) => {
        const program = prevPrograms.find((p) => (p.id ?? p.tempId) === programId);
        if (!program) return prevPrograms;

        // Filter exercises by day and sort by position
        const sameDayExercises = (program.programExercises || [])
          .filter((pe: any) => String(pe.day) === day)
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

        const draggedIdx = sameDayExercises.findIndex(
          (pe: any) => (pe.id ?? pe.tempId) === draggedPeId
        );
        const dropIdx = sameDayExercises.findIndex((pe: any) => (pe.id ?? pe.tempId) === peId);

        if (draggedIdx === -1 || dropIdx === -1) return prevPrograms;

        // Reorder within the same day
        const reordered = [...sameDayExercises];
        const [draggedItem] = reordered.splice(draggedIdx, 1);
        reordered.splice(dropIdx, 0, draggedItem);

        // Update positions for reordered items
        const updatedSameDay = reordered.map((pe: any, idx: number) => ({ ...pe, position: idx }));

        // Merge with other days' exercises
        const otherDaysExercises = (program.programExercises || []).filter(
          (pe: any) => String(pe.day) !== day
        );
        const allExercises = [...otherDaysExercises, ...updatedSameDay];

        return prevPrograms.map((p) =>
          (p.id ?? p.tempId) === programId ? { ...p, programExercises: allExercises } : p
        );
      });

      setDraggedExercise(null);
      setDragOverExercise(null);
    },
    [draggedExercise, setPrograms]
  );

  const handleDragEnd = useCallback(() => {
    // Cancel any pending rAF work
    if (dragOverRafRef.current) {
      cancelAnimationFrame(dragOverRafRef.current);
      dragOverRafRef.current = null;
    }
    if (dragOverColumnRafRef.current) {
      cancelAnimationFrame(dragOverColumnRafRef.current);
      dragOverColumnRafRef.current = null;
    }
    pendingDragOverRef.current = null;
    pendingDragOverColumnRef.current = null;

    // Clear refs synchronously to avoid stale values on the next drag start
    draggedExerciseRef.current = null;
    draggedDayColumnRef.current = null;

    setDraggedExercise(null);
    setDragOverExercise(null);
    setDraggedDayColumn(null);
    setDragOverDayColumn(null);
    setDragOverDayColumnSide(null);
  }, []);

  const handleDragOverColumn = useCallback((e: React.DragEvent, day: string, programId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // If not dragging columns or program mismatch, clear preview early
    if (!draggedDayColumnRef.current || draggedDayColumnRef.current.programId !== programId) {
      setDragOverDayColumn(null);
      setDragOverDayColumnSide(null);
      return;
    }

    // Store latest target and pointer coordinates; defer heavy work to rAF
    pendingDragOverColumnRef.current = {
      day,
      programId,
      pointerY: e.clientY,
      target: e.currentTarget as HTMLElement,
    };
    if (dragOverColumnRafRef.current != null) return;

    dragOverColumnRafRef.current = requestAnimationFrame(() => {
      dragOverColumnRafRef.current = null;
      const pending = pendingDragOverColumnRef.current;
      pendingDragOverColumnRef.current = null;
      const dragged = draggedDayColumnRef.current;
      if (!pending || !dragged || dragged.programId !== pending.programId) {
        setDragOverDayColumn(null);
        setDragOverDayColumnSide(null);
        return;
      }

      const target = pending.target;
      if (!target) {
        setDragOverDayColumn(null);
        setDragOverDayColumnSide(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const y = (pending.pointerY ?? 0) - rect.top;
      const side = y < rect.height / 2 ? 'top' : 'bottom';

      // Only show the preview if the insertion would actually change the order
      // Use ref to access latest programs without causing handler recreation
      const program = programsRef.current.find((p) => (p.id ?? p.tempId) === pending.programId);
      if (!program) {
        setDragOverDayColumn(null);
        setDragOverDayColumnSide(null);
        return;
      }

      const days = [...(program.days || ['A'])];
      const draggedDay = dragged.day;
      const draggedIdx = days.findIndex((d) => d === draggedDay);

      // Build days without the dragged one and compute insertion index
      const daysWithout = days.filter((_, i) => i !== draggedIdx);
      const targetIdxAfterRemoval = daysWithout.findIndex((d) => d === pending.day);
      let insertIdx = targetIdxAfterRemoval;
      if (side === 'bottom') insertIdx = targetIdxAfterRemoval + 1;
      if (insertIdx < 0) insertIdx = 0;
      if (insertIdx > daysWithout.length) insertIdx = daysWithout.length;

      const newDays = [...daysWithout];
      newDays.splice(insertIdx, 0, draggedDay);

      const isSame = newDays.length === days.length && newDays.every((d, i) => d === days[i]);
      if (isSame) {
        setDragOverDayColumn(null);
        setDragOverDayColumnSide(null);
      } else {
        setDragOverDayColumn({ day: pending.day, programId: pending.programId });
        setDragOverDayColumnSide(side);
      }
    });
  }, []);

  const handleDropToNewDay = useCallback(
    async (e: React.DragEvent, targetDay: string, programId: string) => {
      e.preventDefault();

      // Handle column (day) reorder
      if (draggedDayColumn) {
        const srcDay = draggedDayColumn.day;
        const dstDay = targetDay;
        if (srcDay === dstDay || draggedDayColumn.programId !== programId) {
          setDraggedDayColumn(null);
          setDragOverDayColumn(null);
          setDragOverDayColumnSide(null);
          return;
        }

        setPrograms((prevPrograms) => {
          const program = prevPrograms.find((p) => (p.id ?? p.tempId) === programId);
          if (!program) return prevPrograms;

          const days = [...(program.days || ['A'])];
          const draggedIdx = days.findIndex((d) => d === srcDay);
          const dropIdx = days.findIndex((d) => d === dstDay);
          if (draggedIdx === -1 || dropIdx === -1) return prevPrograms;

          // Build groups of exercises per day in the current order
          const groups = days.map((d) =>
            (program.programExercises || [])
              .filter((pe: any) => String(pe.day ?? 'A') === String(d))
              .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
          );

          // Remove the dragged group and compute insert index based on top/bottom
          const groupsWithout = [...groups];
          const [removedGroup] = groupsWithout.splice(draggedIdx, 1);
          const daysWithout = days.filter((_, i) => i !== draggedIdx);
          const targetIdxAfterRemoval = daysWithout.findIndex((d) => d === dstDay);
          let insertIdx = targetIdxAfterRemoval;
          if (dragOverDayColumnSide === 'bottom') insertIdx = targetIdxAfterRemoval + 1;
          if (insertIdx < 0) insertIdx = 0;
          groupsWithout.splice(insertIdx, 0, removedGroup);

          // Reassign day letters (A, B, C, ...) based on new order and reindex positions
          const newProgramExercises: any[] = [];
          const newDays = groupsWithout.map((_, idx) =>
            String.fromCharCode('A'.charCodeAt(0) + idx)
          );
          groupsWithout.forEach((grp, idx) => {
            grp.forEach((pe: any, pos: number) => {
              newProgramExercises.push({ ...pe, day: newDays[idx], position: pos });
            });
          });

          return prevPrograms.map((p) =>
            (p.id ?? p.tempId) === programId
              ? { ...p, programExercises: newProgramExercises, days: newDays }
              : p
          );
        });

        try {
          await updateProgramExercisesPositions(programId);
        } catch (err) {
          logError('Error normalizing after day reorder', err);
        }

        setDraggedDayColumn(null);
        setDragOverDayColumn(null);
        setDragOverDayColumnSide(null);
        return;
      }

      // Handle exercise move to different day
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

      setPrograms((prevPrograms) => {
        const program = prevPrograms.find((p) => (p.id ?? p.tempId) === programId);
        if (!program) return prevPrograms;

        // Find the dragged exercise
        const draggedItem = (program.programExercises || []).find(
          (pe: any) => (pe.id ?? pe.tempId) === draggedPeId
        );
        if (!draggedItem) return prevPrograms;

        // Remove dragged item from its current position
        const withoutDragged = (program.programExercises || []).filter(
          (pe: any) => (pe.id ?? pe.tempId) !== draggedPeId
        );

        // Determine insertion position in target day
        let insertPosition = 0;
        if (dragOverExercise?.day === targetDay && dragOverExercise?.peId !== '__end__') {
          const targetDayItems = withoutDragged
            .filter((pe: any) => String(pe.day) === targetDay)
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
          const insertBeforeIdx = targetDayItems.findIndex(
            (it: any) => (it.id ?? it.tempId) === dragOverExercise.peId
          );
          insertPosition = insertBeforeIdx !== -1 ? insertBeforeIdx : targetDayItems.length;
        } else {
          const targetDayItems = withoutDragged.filter((pe: any) => String(pe.day) === targetDay);
          insertPosition = targetDayItems.length;
        }

        // Update dragged item with new day
        const updatedDraggedItem = { ...draggedItem, day: targetDay };

        // Recalculate positions for source day (shift down after removal)
        const sourceDayUpdated = withoutDragged
          .filter((pe: any) => String(pe.day) === draggedDay)
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
          .map((pe: any, idx: number) => ({ ...pe, position: idx }));

        // Recalculate positions for target day (insert at position)
        const targetDayItems = withoutDragged
          .filter((pe: any) => String(pe.day) === targetDay)
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
        targetDayItems.splice(insertPosition, 0, updatedDraggedItem);
        const targetDayUpdated = targetDayItems.map((pe: any, idx: number) => ({
          ...pe,
          position: idx,
        }));

        // Merge with other days (unchanged)
        const otherDays = withoutDragged.filter(
          (pe: any) => String(pe.day) !== draggedDay && String(pe.day) !== targetDay
        );
        const allExercises = [...otherDays, ...sourceDayUpdated, ...targetDayUpdated];

        return prevPrograms.map((p) =>
          (p.id ?? p.tempId) === programId ? { ...p, programExercises: allExercises } : p
        );
      });

      setDraggedExercise(null);
      setDragOverExercise(null);
    },
    [
      draggedDayColumn,
      dragOverDayColumnSide,
      draggedExercise,
      dragOverExercise,
      updateProgramExercisesPositions,
      setPrograms,
    ]
  );

  const handleDragOverEnd = useCallback(
    (e: React.DragEvent, day: string, programId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedExercise) {
        setDragOverExercise({ peId: '__end__', day, programId });
      }
    },
    [draggedExercise]
  );

  const handleDropEnd = useCallback(
    async (e: React.DragEvent, day: string, programId: string) => {
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

      setPrograms((prevPrograms) => {
        const program = prevPrograms.find((p) => (p.id ?? p.tempId) === programId);
        if (!program) return prevPrograms;

        const items = (program.programExercises || [])
          .filter((pe: any) => String(pe.day) === day)
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

        const draggedIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === draggedPeId);
        if (draggedIdx === -1) return prevPrograms;

        // Move to the end
        const newItems = [...items];
        const [draggedItem] = newItems.splice(draggedIdx, 1);
        newItems.push(draggedItem);

        // Update positions
        const updatedItems = newItems.map((pe: any, idx: number) => ({ ...pe, position: idx }));
        const otherDays = (program.programExercises || []).filter(
          (pe: any) => String(pe.day) !== day
        );
        const merged = [...otherDays, ...updatedItems];

        return prevPrograms.map((p) =>
          (p.id ?? p.tempId) === programId ? { ...p, programExercises: merged } : p
        );
      });

      // Persist the changes
      try {
        await updateProgramExercisesPositions(programId);
      } catch (err) {
        logError('Error persisting exercise positions', err);
      }

      setDraggedExercise(null);
      setDragOverExercise(null);
    },
    [draggedExercise, updateProgramExercisesPositions, setPrograms]
  );

  // Day column drag handlers
  const handleDayDragStart = useCallback(
    (e: React.DragEvent, day: string, programId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      if (draggedExercise) return; // ignore if an exercise drag is active
      // Some browsers require setting data to enable drop
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'day', day, programId }));
      } catch {}
      // Update ref synchronously so immediate dragover events see the current dragged column
      draggedDayColumnRef.current = { day, programId };
      setDraggedDayColumn({ day, programId });
    },
    [draggedExercise]
  );
  const handleDayDragOver = useCallback(
    (e: React.DragEvent, day: string, programId: string) => {
      e.preventDefault();
      if (!draggedDayColumn || draggedDayColumn.programId !== programId) return;
      setDragOverDayColumn({ day, programId });
    },
    [draggedDayColumn]
  );
  const handleDayDrop = useCallback(
    (e: React.DragEvent, day: string, programId: string) => {
      return handleDropToNewDay(e, day, programId);
    },
    [handleDropToNewDay]
  );

  const programTabTriggerClass =
    'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 h-7 text-sm font-medium bg-transparent text-muted-foreground shadow-none border-0 cursor-pointer select-none';
  void programTabTriggerClass;
  const dayColumnClass =
    'relative border rounded-lg p-2 bg-muted/10 w-full overflow-hidden min-w-0';
  const exerciseCardClass =
    'p-2 bg-white rounded-lg border flex items-center justify-between gap-2 transition-shadow duration-150 hover:shadow-lg';
  void exerciseCardClass;
  const iconButtonClass = 'h-4 w-4';

  // Helpers
  const addNewDayToProgram = (programKey: string) => {
    setPrograms((prev) =>
      prev.map((pr) => {
        const key = pr.id ?? pr.tempId;
        if (key !== programKey) return pr;
        const last = (pr.days || ['A']).slice(-1)[0] ?? 'A';
        const next = String.fromCharCode(last.charCodeAt(0) + 1);
        return { ...pr, days: [...(pr.days || ['A']), next] };
      })
    );
  };

  const isVideo = (file?: string) => {
    if (!file) return false;
    const lower = file.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="px-1 flex-1 flex flex-col">
        {/* LIST VIEW */}
        {!viewingProgramId ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div />
              {!isClient && (
                <div className="flex items-center gap-2">
                  <Button onClick={addProgram}>
                    <Plus className="mr-0 h-4 w-4" />
                    Crear Programa
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Nombre</TableHead>
                    <TableHead className="w-[60%]">Descripción</TableHead>
                    <TableHead className="w-[80px] text-right">Días</TableHead>
                    <TableHead className="w-[100px] text-right">Ejercicios</TableHead>
                    <TableHead className="text-right pr-4 w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.map((p) => {
                    const idKey = p.id ?? p.tempId;
                    const daysCount = (p.days || []).length;
                    const exercisesCount = (p.programExercises || []).length;
                    const rawDescription = typeof p.description === 'string' ? p.description : '';
                    const descriptionText = rawDescription.replace(/<[^>]*>/g, '').trim();
                    const sanitizedDescription = (() => {
                      if (!rawDescription) return '';
                      // Sanitize first, then add utility classes so list markers appear correctly in the tooltip
                      const clean = DOMPurify.sanitize(rawDescription, {
                        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'br', 'p'],
                        ALLOWED_ATTR: [],
                      });
                      // Add Tailwind utility classes to ol/ul so they show numbers/bullets and proper padding
                      return clean
                        .replace(/<ol(\s|>)/gi, '<ol class="pl-5 list-decimal"$1')
                        .replace(/<ul(\s|>)/gi, '<ul class="pl-5 list-disc"$1');
                    })();
                    return (
                      <TableRow
                        key={idKey}
                        onClick={() => {
                          setViewingProgramId(idKey);
                          setActiveProgramId(idKey);
                        }}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="w-[60%]">
                          {descriptionText ? (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block max-w-[820px] truncate text-muted-foreground">
                                    {descriptionText}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-lg cursor-default">
                                  <div
                                    className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words text-sm"
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizedDescription || 'Sin descripción',
                                    }}
                                  />
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{daysCount}</TableCell>
                        <TableCell className="text-right">{exercisesCount}</TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex justify-end gap-2">
                            {!isClient && (
                              <ActionButton
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await deleteProgram(idKey);
                                  } catch (err) {
                                    logError(err);
                                  }
                                }}
                                tooltip="Eliminar programa"
                              >
                                <Trash className="h-4 w-4" />
                              </ActionButton>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          /* DETAIL VIEW: render single program (reuse existing program rendering) */
          (() => {
            const p = programs.find((x) => (x.id ?? x.tempId) === viewingProgramId)!;
            if (!p) return <div className="text-muted-foreground p-4">Programa no encontrado</div>;
            return (
              <div>
                <div className="flex items-center justify-between mb-4 gap-2">
                  <div className="flex items-center gap-2">
                    {editingProgramId === (p.id ?? p.tempId) ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingProgramName}
                        onChange={(e) => setEditingProgramName(e.target.value)}
                        onBlur={async () => {
                          if (editingProgramName.trim()) {
                            await saveProgramName(p.id ?? p.tempId, editingProgramName);
                          }
                          setEditingProgramId(null);
                          setEditingProgramName('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingProgramName.trim()) {
                              saveProgramName(p.id ?? p.tempId, editingProgramName).then(() => {
                                setEditingProgramId(null);
                                setEditingProgramName('');
                              });
                            } else {
                              setEditingProgramId(null);
                              setEditingProgramName('');
                            }
                          } else if (e.key === 'Escape') {
                            setEditingProgramId(null);
                            setEditingProgramName('');
                          }
                        }}
                        className="text-sm font-semibold border-b border-slate-200 px-2 py-1 bg-transparent appearance-none focus:outline-none focus:ring-0"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{p.name}</h3>
                        {!isClient && (
                          <ActionButton
                            tooltip="Editar nombre"
                            onClick={() => {
                              setEditingProgramId(p.id ?? p.tempId);
                              setEditingProgramName(p.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </ActionButton>
                        )}
                      </div>
                    )}

                    {/* Description dropdown */}
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
                          onChange={
                            isClient
                              ? () => {}
                              : (val) =>
                                  setPrograms((prev) =>
                                    prev.map((x) =>
                                      x.id === p.id || x.tempId === p.tempId
                                        ? { ...x, description: val }
                                        : x
                                    )
                                  )
                          }
                          placeholder="Descripción del programa"
                          className="min-h-[120px]"
                          readOnly={isClient}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Button variant="outline" onClick={() => setViewingProgramId(null)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                </div>

                <div className="p-0 space-y-4 h-full">
                    <div className="flex flex-col gap-4 px-4 pt-4 w-full overflow-hidden min-w-0">
                      {(() => {
                        // Defensive: ensure `days` is a proper array of strings; fall back to extracting days from programExercises or ['A']
                        let daysArr: string[] =
                          Array.isArray(p.days) && p.days.length
                            ? [...p.days]
                            : (p.programExercises || []).length
                              ? Array.from(
                                  new Set(
                                    (p.programExercises || []).map((pe: any) =>
                                      String(pe.day ?? 'A')
                                    )
                                  )
                                )
                              : ['A'];
                        // Force alphabetical order (A,B,C...)
                        daysArr = daysArr
                          .slice()
                          .sort((a: string, b: string) => a.charCodeAt(0) - b.charCodeAt(0));

                        return daysArr.slice(0, 7).map((day: string, _di: number) => {
                          const items = (p.programExercises || [])
                            .filter((pe: any) => String(pe.day) === day)
                            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                          return (
                            <div
                              key={day}
                              className={dayColumnClass}
                              onDragOver={
                                !isClient
                                  ? (e) => handleDragOverColumn(e, day, p.id ?? p.tempId)
                                  : undefined
                              }
                              onDrop={
                                !isClient
                                  ? (e) => handleDropToNewDay(e, day, p.id ?? p.tempId)
                                  : undefined
                              }
                              onDragLeave={() => {
                                if (
                                  dragOverDayColumn?.day === day &&
                                  dragOverDayColumn?.programId === (p.id ?? p.tempId)
                                ) {
                                  setDragOverDayColumn(null);
                                  setDragOverDayColumnSide(null);
                                }
                              }}
                            >
                              {draggedDayColumn &&
                                dragOverDayColumn?.day === day &&
                                dragOverDayColumn?.programId === (p.id ?? p.tempId) && (
                                  <>
                                    {dragOverDayColumnSide === 'top' && (
                                      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[3px] bg-blue-500" />
                                    )}
                                    {dragOverDayColumnSide === 'bottom' && (
                                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500" />
                                    )}
                                  </>
                                )}
                              <div className="flex items-center justify-between mb-2">
                                <div
                                  className={cn(
                                    'text-sm font-medium pl-2',
                                    isClient ? 'cursor-default flex-1' : 'cursor-move flex-1'
                                  )}
                                  role="button"
                                  aria-grabbed={draggedDayColumn?.day === day ? 'true' : 'false'}
                                  tabIndex={0}
                                  draggable={!isClient}
                                  onDragStart={
                                    !isClient
                                      ? (e) => handleDayDragStart(e, day, p.id ?? p.tempId)
                                      : undefined
                                  }
                                  onDragOver={
                                    !isClient
                                      ? (e) => handleDayDragOver(e, day, p.id ?? p.tempId)
                                      : undefined
                                  }
                                  onDrop={
                                    !isClient
                                      ? (e) => handleDayDrop(e, day, p.id ?? p.tempId)
                                      : undefined
                                  }
                                  onDragEnd={!isClient ? handleDragEnd : undefined}
                                >
                                  {`Día ${day}`}
                                </div>
                                <div>
                                  {!isClient && (
                                    <ActionButton
                                      tooltip="Eliminar día"
                                      draggable={false}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={() => {
                                        const key = p.id ?? p.tempId;
                                        setPrograms((prev) =>
                                          prev.map((pr) => {
                                            const k = pr.id ?? pr.tempId;
                                            if (k !== key) return pr;
                                            return {
                                              ...pr,
                                              days: (pr.days || []).filter(
                                                (d: string) => d !== day
                                              ),
                                              programExercises: (pr.programExercises || []).filter(
                                                (pe: any) => String(pe.day ?? 'A') !== String(day)
                                              ),
                                            };
                                          })
                                        );
                                        try {
                                          updateProgramExercisesPositions(key);
                                        } catch (err) {
                                          logError('Error normalizing after local delete day', err);
                                        }
                                      }}
                                      aria-label="Eliminar día"
                                    >
                                      <Trash className={iconButtonClass} />
                                    </ActionButton>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2 min-h-[40px]">
                                {/* Horizontal row with scroll; items are fixed-width and won't shrink */}
                                <div className="flex flex-row gap-4 overflow-x-auto overflow-y-hidden pb-2 px-2 w-full max-w-full min-w-0">
                                  {items.map((pe: any) => {
                                    const exercise = pe.exercise || {};

                                    // Map anatomy IDs to names
                                    const anatomyIds = Array.isArray(exercise.anatomy)
                                      ? exercise.anatomy
                                      : [];
                                    const exerciseAnatomy = anatomyIds
                                      .map((aId: any) => {
                                        const id = String(aId ?? '');
                                        const found = anatomyForPicker.find(
                                          (a: any) => String(a.id) === id
                                        );
                                        return found || null;
                                      })
                                      .filter((x: any) => x !== null);

                                    // Map equipment IDs to names
                                    const equipmentIds = Array.isArray(exercise.equipment)
                                      ? exercise.equipment
                                      : [];
                                    const exerciseEquipment = equipmentIds
                                      .map((eqId: any) => {
                                        const id = String(eqId ?? '');
                                        const found = equipmentForPicker.find(
                                          (eq: any) => String(eq.id) === id
                                        );
                                        return found || null;
                                      })
                                      .filter((x: any) => x !== null);

                                    const file = (exercise.file as string | undefined) || undefined;
                                    const mediaUrl =
                                      file && exercise.id
                                        ? getFilePublicUrl('exercise_videos', exercise.id, file) ||
                                          undefined
                                        : undefined;

                                    return (
                                      <div
                                        key={pe.id || pe.tempId}
                                        className="relative w-[260px] flex-none"
                                      >
                                        {dragOverExercise?.peId === (pe.id ?? pe.tempId) &&
                                          dragOverExercise?.programId === (p.id ?? p.tempId) && (
                                            <div className="absolute -left-1 top-0 bottom-0 w-[3px] bg-blue-500 pointer-events-none z-50" />
                                          )}
                                        <div className="relative">
                                          <Card
                                            role="button"
                                            aria-grabbed={
                                              draggedExercise?.peId === (pe.id ?? pe.tempId)
                                                ? 'true'
                                                : 'false'
                                            }
                                            tabIndex={0}
                                            draggable={!isClient}
                                            onDragStart={
                                              !isClient
                                                ? (e) =>
                                                    handleDragStart(
                                                      e,
                                                      pe.id ?? pe.tempId,
                                                      day,
                                                      p.id ?? p.tempId
                                                    )
                                                : undefined
                                            }
                                            onDragOver={
                                              !isClient
                                                ? (e) =>
                                                    handleDragOver(
                                                      e,
                                                      pe.id ?? pe.tempId,
                                                      day,
                                                      p.id ?? p.tempId
                                                    )
                                                : undefined
                                            }
                                            onDrop={
                                              !isClient
                                                ? (e) =>
                                                    handleDrop(
                                                      e,
                                                      pe.id ?? pe.tempId,
                                                      day,
                                                      p.id ?? p.tempId
                                                    )
                                                : undefined
                                            }
                                            onDragEnd={!isClient ? handleDragEnd : undefined}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && !isClient) {
                                                setEditingProgramExercise(pe);
                                                setShowEditProgramExerciseDialog(true);
                                              }
                                            }}
                                            className={cn(
                                              'overflow-hidden hover:shadow-lg transition-shadow h-[300px] w-full flex flex-col min-w-0',
                                              draggedExercise?.peId === (pe.id ?? pe.tempId) &&
                                                'opacity-50',
                                              'bg-white rounded-lg border',
                                              isClient ? 'cursor-default' : 'cursor-move'
                                            )}
                                          >
                                            <CardHeader className="py-1 px-4 h-auto space-y-0.5">
                                              <div className="flex items-center justify-between gap-2">
                                                <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="flex-1 line-clamp-2">
                                                      <span className="flex items-center gap-2">
                                                        <span className="truncate">
                                                          {exercise.name ||
                                                            pe.exercise?.name ||
                                                            'Ejercicio'}
                                                        </span>
                                                        <TooltipProvider delayDuration={150}>
                                                          <Tooltip>
                                                            <TooltipTrigger asChild>
                                                              <span
                                                                className="text-muted-foreground cursor-default"
                                                                aria-label="Notas del ejercicio"
                                                              >
                                                                <HelpCircle className="h-4 w-4" />
                                                              </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                                                              <div
                                                                className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words text-sm"
                                                                dangerouslySetInnerHTML={{
                                                                  __html:
                                                                    pe.notes &&
                                                                    String(pe.notes).trim()
                                                                      ? DOMPurify.sanitize(
                                                                          pe.notes,
                                                                          {
                                                                            ALLOWED_TAGS: [
                                                                              'b',
                                                                              'strong',
                                                                              'i',
                                                                              'em',
                                                                              'ul',
                                                                              'ol',
                                                                              'li',
                                                                              'br',
                                                                              'p',
                                                                            ],
                                                                            ALLOWED_ATTR: [],
                                                                          }
                                                                        )
                                                                      : 'Sin notas',
                                                                }}
                                                              />
                                                            </TooltipContent>
                                                          </Tooltip>
                                                        </TooltipProvider>
                                                      </span>
                                                    </span>
                                                  </div>
                                                </CardTitle>
                                                {!isClient && (
                                                  <>
                                                    <ActionButton
                                                      tooltip="Editar ejercicio"
                                                      onClick={() => {
                                                        setEditingProgramExercise(pe);
                                                        setShowEditProgramExerciseDialog(true);
                                                      }}
                                                      aria-label="Editar ejercicio"
                                                    >
                                                      <Pencil className="h-4 w-4" />
                                                    </ActionButton>
                                                    <ActionButton
                                                      tooltip="Eliminar ejercicio"
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                          if (
                                                            String(pe.tempId || '').startsWith(
                                                              'tpe-'
                                                            )
                                                          ) {
                                                            setPrograms((prev) =>
                                                              prev.map((pr) =>
                                                                pr.tempId === p.tempId
                                                                  ? {
                                                                      ...pr,
                                                                      programExercises: (
                                                                        pr.programExercises || []
                                                                      ).filter(
                                                                        (x: any) =>
                                                                          x.tempId !== pe.tempId
                                                                      ),
                                                                    }
                                                                  : pr
                                                              )
                                                            );
                                                            await updateProgramExercisesPositions(
                                                              p.id ?? p.tempId
                                                            );
                                                            return;
                                                          }
                                                          setPrograms((prev) =>
                                                            prev.map((pr) =>
                                                              (pr.id ?? pr.tempId) ===
                                                              (p.id ?? p.tempId)
                                                                ? {
                                                                    ...pr,
                                                                    programExercises: (
                                                                      pr.programExercises || []
                                                                    ).filter(
                                                                      (x: any) => x.id !== pe.id
                                                                    ),
                                                                  }
                                                                : pr
                                                            )
                                                          );
                                                          await updateProgramExercisesPositions(
                                                            p.id ?? p.tempId
                                                          );
                                                        } catch (err) {
                                                          logError(
                                                            'Error deleting program_exercise',
                                                            err
                                                          );
                                                        }
                                                      }}
                                                      aria-label="Eliminar ejercicio"
                                                    >
                                                      <Trash className={iconButtonClass} />
                                                    </ActionButton>
                                                  </>
                                                )}
                                              </div>

                                              <div className="flex flex-col gap-1 min-h-[40px]">
                                                {exerciseEquipment.length > 0 && (
                                                  <ExerciseBadgeGroup
                                                    items={exerciseEquipment}
                                                    color="blue"
                                                    maxVisible={2}
                                                  />
                                                )}
                                                {exerciseAnatomy.length > 0 && (
                                                  <ExerciseBadgeGroup
                                                    items={exerciseAnatomy}
                                                    color="orange"
                                                    maxVisible={2}
                                                  />
                                                )}
                                              </div>
                                            </CardHeader>

                                            <div className="relative bg-slate-200 overflow-hidden flex-1 cursor-auto">
                                              {mediaUrl ? (
                                                isVideo(file) ? (
                                                  <video
                                                    src={mediaUrl}
                                                    draggable={false}
                                                    onDragStart={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    className="absolute inset-0 w-full h-full object-cover cursor-auto"
                                                    controls
                                                  />
                                                ) : (
                                                  <img
                                                    src={mediaUrl}
                                                    draggable={false}
                                                    onDragStart={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    className="absolute inset-0 w-full h-full object-cover cursor-auto"
                                                  />
                                                )
                                              ) : (
                                                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-100">
                                                  <p className="text-sm text-slate-400">
                                                    Sin video
                                                  </p>
                                                </div>
                                              )}
                                            </div>

                                            {(() => {
                                              const valOrDash = (v: any) =>
                                                typeof v !== 'undefined' && v !== null && v !== ''
                                                  ? v
                                                  : '-';
                                              return (
                                                <div className="px-3 py-1.5 text-xs text-muted-foreground border-t">
                                                  <div className="flex items-center gap-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-muted-foreground">
                                                        Series:
                                                      </span>{' '}
                                                      <span className="font-medium text-foreground">
                                                        {valOrDash(pe.sets)}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-muted-foreground">
                                                        Reps:
                                                      </span>{' '}
                                                      <span className="font-medium text-foreground">
                                                        {valOrDash(pe.reps)}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-muted-foreground">
                                                        kg:
                                                      </span>{' '}
                                                      <span className="font-medium text-foreground">
                                                        {valOrDash(pe.weight)}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-muted-foreground">
                                                        Secs:
                                                      </span>{' '}
                                                      <span className="font-medium text-foreground">
                                                        {valOrDash(pe.secs)}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </Card>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Placeholder card to add a new exercise */}
                                  {!isClient && (
                                    <div
                                      key="add-placeholder"
                                      className="relative w-[260px] flex-none"
                                    >
                                      {dragOverExercise?.peId === '__end__' &&
                                        dragOverExercise?.day === day &&
                                        dragOverExercise?.programId === (p.id ?? p.tempId) && (
                                          <div className="absolute -left-1 top-0 bottom-0 w-[3px] bg-blue-500 pointer-events-none z-50" />
                                        )}
                                      <Card
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            openAddExercisesDialog(p.id ?? p.tempId, day);
                                          }
                                        }}
                                        onClick={() =>
                                          openAddExercisesDialog(p.id ?? p.tempId, day)
                                        }
                                        onDragOver={(e) =>
                                          handleDragOverEnd(e, day, p.id ?? p.tempId)
                                        }
                                        onDrop={(e) => handleDropEnd(e, day, p.id ?? p.tempId)}
                                        onDragLeave={() => {
                                          if (
                                            dragOverExercise?.peId === '__end__' &&
                                            dragOverExercise?.day === day
                                          ) {
                                            setDragOverExercise(null);
                                          }
                                        }}
                                        className={cn(
                                          'overflow-hidden hover:shadow-lg transition-shadow h-[300px] w-full flex flex-col cursor-pointer bg-slate-200 rounded-lg border'
                                        )}
                                      >
                                        <div className="w-full h-full flex items-center justify-center">
                                          <div className="flex flex-col items-center gap-2 text-slate-500">
                                            <Plus className="h-6 w-6" />
                                            <p className="text-sm">Añadir</p>
                                          </div>
                                        </div>
                                      </Card>
                                    </div>
                                  )}
                                </div>

                                {/* Removed the empty drop zone - functionality now handled by placeholder card */}
                              </div>
                            </div>
                          );
                        });
                      })()}

                      {/* Add new day button */}
                      {(() => {
                        const safeLen = Array.isArray(p.days)
                          ? p.days.length
                          : (p.programExercises || []).length
                            ? Array.from(
                                new Set(
                                  (p.programExercises || []).map((pe: any) => String(pe.day ?? 'A'))
                                )
                              ).length
                            : 1;
                        return safeLen < 7 ? (
                          !isClient ? (
                            <div className="flex items-center mb-6">
                              <Button
                                variant="secondary"
                                className="btn-propagate px-4 py-2"
                                onClick={() => addNewDayToProgram(p.id ?? p.tempId)}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Día
                              </Button>
                            </div>
                          ) : null
                        ) : null;
                      })()}
                    </div>
                </div>
              </div>
            );
          })()
        )}

        <ProgramExerciseDialog
          open={showEditProgramExerciseDialog}
          onOpenChange={setShowEditProgramExerciseDialog}
          programExercise={editingProgramExercise}
          onSaved={(updated) => {
            if (!updated) return;
            const targetProgram =
              updated.program ?? editingProgramExercise?.program ?? activeProgramId;
            setPrograms((prev) =>
              prev.map((pr) => {
                const key = pr.id ?? pr.tempId;
                if (key !== targetProgram) return pr;
                const list = (pr.programExercises || []).map((pe: any) => {
                  const peKey = pe.id ?? pe.tempId;
                  const updatedKey = updated.id ?? updated.tempId;
                  return peKey === updatedKey ? { ...pe, ...updated } : pe;
                });
                return { ...pr, programExercises: list };
              })
            );
            updateProgramExercisesPositions(targetProgram).catch((err) =>
              logError('Error normalizing after save', err)
            );
          }}
        />

        <Dialog open={showAddExercisesDialog} onOpenChange={setShowAddExercisesDialog}>
          <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Añadir ejercicios al programa</DialogTitle>
              <DialogDescription>Selecciona ejercicios para añadir al programa</DialogDescription>
            </DialogHeader>

            {showSavedToast && savedToastTitle && (
              <InviteToast
                title={savedToastTitle}
                durationMs={2500}
                onClose={() => setShowSavedToast(false)}
              />
            )}

            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search bar */}
              <Input
                placeholder="Buscar ejercicios..."
                value={exerciseSearchTerm}
                onChange={(e) => setExerciseSearchTerm(e.target.value)}
                className="w-auto"
              />

              {/* Equipment filter */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-between text-left text-sm gap-1">
                      <span>Equipamiento</span>
                      <div className="flex items-center gap-1">
                        {selectedFilterEquipment.length > 0 && (
                          <span className="font-medium">{selectedFilterEquipment.length}</span>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
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
                        {equipmentForPicker
                          .filter((eq: any) =>
                            normalizeForSearch(eq.name).includes(
                              normalizeForSearch(equipmentFilterQuery)
                            )
                          )
                          .map((eq: any) => (
                            <label
                              key={eq.id}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={selectedFilterEquipment.includes(eq.id)}
                                onCheckedChange={(checked: boolean | 'indeterminate') => {
                                  const isChecked = Boolean(checked);
                                  if (isChecked) {
                                    setSelectedFilterEquipment([...selectedFilterEquipment, eq.id]);
                                  } else {
                                    setSelectedFilterEquipment(
                                      selectedFilterEquipment.filter((id) => id !== eq.id)
                                    );
                                  }
                                }}
                              />
                              <span>{eq.name}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Anatomy filter */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-between text-left text-sm gap-1">
                      <span>Anatomía</span>
                      <div className="flex items-center gap-1">
                        {selectedFilterAnatomy.length > 0 && (
                          <span className="font-medium">{selectedFilterAnatomy.length}</span>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
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
                        {anatomyForPicker
                          .filter((a: any) =>
                            normalizeForSearch(a.name).includes(
                              normalizeForSearch(anatomyFilterQuery)
                            )
                          )
                          .map((a: any) => (
                            <label
                              key={a.id}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={selectedFilterAnatomy.includes(a.id)}
                                onCheckedChange={(checked: boolean | 'indeterminate') => {
                                  const isChecked = Boolean(checked);
                                  if (isChecked) {
                                    setSelectedFilterAnatomy([...selectedFilterAnatomy, a.id]);
                                  } else {
                                    setSelectedFilterAnatomy(
                                      selectedFilterAnatomy.filter((id) => id !== a.id)
                                    );
                                  }
                                }}
                              />
                              <span>{a.name}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Clear filters button */}
              {(exerciseSearchTerm ||
                selectedFilterAnatomy.length > 0 ||
                selectedFilterEquipment.length > 0) && (
                <Button
                  variant="outline"
                  className="text-sm"
                  onClick={() => {
                    setExerciseSearchTerm('');
                    setSelectedFilterAnatomy([]);
                    setSelectedFilterEquipment([]);
                  }}
                >
                  Limpiar
                </Button>
              )}
            </div>

            {/* Applied filters display */}
            {(selectedFilterEquipment.length > 0 || selectedFilterAnatomy.length > 0) && (
              <div className="flex gap-2 flex-wrap">
                {selectedFilterEquipment.map((id) => {
                  const e = equipmentForPicker.find((x: any) => x.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 border-blue-200"
                    >
                      {e?.name}
                      <button
                        className="ml-1"
                        onClick={() =>
                          setSelectedFilterEquipment(
                            selectedFilterEquipment.filter((i) => i !== id)
                          )
                        }
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
                {selectedFilterAnatomy.map((id) => {
                  const a = anatomyForPicker.find((x: any) => x.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="bg-orange-100 text-orange-800 border-orange-200"
                    >
                      {a?.name}
                      <button
                        className="ml-1"
                        onClick={() =>
                          setSelectedFilterAnatomy(selectedFilterAnatomy.filter((i) => i !== id))
                        }
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2">
              {exercisesLoading ? (
                <div className="py-6 flex items-center justify-center">Cargando ejercicios...</div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    {filteredExercisesForDialog.length} ejercicio
                    {filteredExercisesForDialog.length !== 1 ? 's' : ''} encontrado
                    {filteredExercisesForDialog.length !== 1 ? 's' : ''}
                  </p>
                  {filteredExercisesForDialog.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-slate-500 text-lg">
                        No hay ejercicios que coincidan con los filtros
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredExercisesForDialog.map((ex) => {
                        const exerciseAnatomy = anatomyForPicker.filter((a: any) =>
                          (ex.anatomy || []).some((x: any) => String(x?.id ?? x ?? '') === a.id)
                        );
                        const exerciseEquipment = equipmentForPicker.filter((eq: any) =>
                          (ex.equipment || []).some((x: any) => String(x?.id ?? x ?? '') === eq.id)
                        );
                        const file = (ex.file as string | undefined) || undefined;
                        const isVideo = (file?: string) => {
                          if (!file) return false;
                          const lower = file.toLowerCase();
                          return (
                            lower.endsWith('.mp4') ||
                            lower.endsWith('.mov') ||
                            lower.endsWith('.webm')
                          );
                        };
                        const mediaUrl = file
                          ? getFilePublicUrl('exercise_videos', ex.id, file) || null
                          : null;

                        return (
                          <Card
                            key={ex.id}
                            className={cn(
                              'overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer',
                              selectedExerciseIds.has(ex.id) ? 'border-primary' : ''
                            )}
                            onClick={() => toggleSelectExercise(ex.id)}
                          >
                            <CardHeader className="py-2 px-4">
                              <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">
                                  {ex.name}
                                </CardTitle>
                                <Checkbox
                                  checked={selectedExerciseIds.has(ex.id)}
                                  onCheckedChange={() => toggleSelectExercise(ex.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="flex flex-col gap-0.5 min-h-[10px]">
                                {exerciseEquipment.length > 0 && (
                                  <ExerciseBadgeGroup
                                    items={exerciseEquipment}
                                    color="blue"
                                    maxVisible={2}
                                  />
                                )}
                                {exerciseAnatomy.length > 0 && (
                                  <ExerciseBadgeGroup
                                    items={exerciseAnatomy}
                                    color="orange"
                                    maxVisible={2}
                                  />
                                )}
                              </div>
                            </CardHeader>

                            <div
                              className="relative bg-slate-200 overflow-hidden mt-auto group shrink-media cursor-auto"
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
                                  <video
                                    src={mediaUrl}
                                    draggable={false}
                                    onDragStart={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="w-full h-auto object-cover aspect-video cursor-auto"
                                    controls
                                    playsInline
                                  />
                                ) : (
                                  <img
                                    src={mediaUrl}
                                    alt={ex.name}
                                    draggable={false}
                                    onDragStart={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="w-full h-auto object-cover aspect-video cursor-auto"
                                  />
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
                </>
              )}
            </div>

            <div className="flex gap-2 justify-end p-2 border-t">
              <Button variant="outline" onClick={() => setShowAddExercisesDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmAddExercises}>Añadir</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
