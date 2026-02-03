import React, { useState, useEffect, useMemo } from 'react';
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
import ResolvedMedia from '@/components/media/ResolvedMedia';
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
    persistProgram,
    resetToInitial,
    hasPendingChanges,
    notifySaved,
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

  // Simple drag & drop reordering (within same day). Reordering is preview-only and marked as pending—press 'Guardar' to persist positions.

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

  const [savingProgram, setSavingProgram] = useState(false);

  // Helpers to render placeholders: we'll compute a display array in the render loop for each day.














  const programTabTriggerClass =
    'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 h-7 text-sm font-medium bg-transparent text-muted-foreground shadow-none border-0 cursor-pointer select-none';
  void programTabTriggerClass;
  const dayColumnClass =
    'relative border rounded-lg p-2 bg-muted/10 w-full overflow-hidden min-w-0';
  const exerciseCardClass =
    'p-2 bg-white rounded-lg border flex items-center justify-between gap-2 transition-shadow duration-150 hover:shadow-lg';
  void exerciseCardClass;
  const iconButtonClass = 'h-4 w-4';

  // Performance: use refs + DOM class toggles + rAF to avoid re-rendering on every dragover event
  const draggingRef = React.useRef<{ peKey: string; day: string; el?: HTMLElement } | null>(null);
  const dragOverRef = React.useRef<{ peKey?: string; day?: string; el?: HTMLElement; position?: 'end' | 'before' | 'after' } | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const clearDragOverHighlight = () => {
    const prev = dragOverRef.current;
    if (prev?.el) {
      prev.el.classList.remove('ring-2', 'ring-blue-400');
    }
    dragOverRef.current = null;
  };

  const onDragStart = (e: React.DragEvent, peKey: string, day: string) => {
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ peKey, day }));
    } catch (err) {
      // ignore
    }
    // store reference to dragged element and add visual class without triggering React render
    const el = e.currentTarget as HTMLElement;
    el.classList.add('opacity-60');
    draggingRef.current = { peKey, day, el };
  };

  const onDragEnd = () => {
    // remove dragged visual
    if (draggingRef.current?.el) {
      draggingRef.current.el.classList.remove('opacity-60');
    }
    draggingRef.current = null;
    // clear any highlights
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    clearDragOverHighlight();
    removeDropPlaceholder();
  };

  // Floating drop placeholder to avoid layout reflow
  const dropPlaceholderRef = React.useRef<HTMLElement | null>(null);

  const createFloatingPlaceholder = (parent: HTMLElement) => {
    let ph = dropPlaceholderRef.current;
    if (!ph) {
      ph = document.createElement('div');
      ph.style.position = 'absolute';
      ph.style.width = '2px';
      ph.style.borderRadius = '2px';
      ph.style.background = 'var(--primary-gradient)';
      ph.style.pointerEvents = 'none';
      ph.style.transition = 'transform 120ms ease, opacity 120ms ease';
      ph.style.opacity = '0.95';
      ph.style.zIndex = '40';
      dropPlaceholderRef.current = ph;
    }
    // ensure parent is positioned
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    if (ph.parentNode !== parent) {
      if (ph.parentNode) ph.parentNode.removeChild(ph);
      parent.appendChild(ph);
    }
    return ph;
  };

  const removeDropPlaceholder = () => {
    const ph = dropPlaceholderRef.current;
    if (!ph) return;
    if (ph.parentNode) ph.parentNode.removeChild(ph);
  };

  const scheduleHighlight = (el: HTMLElement | null, peKey?: string, day?: string, clientX?: number | 'end', clientY?: number) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      // remove previous ring highlight
      clearDragOverHighlight();
      removeDropPlaceholder();

      if (!el) {
        dragOverRef.current = null;
        return;
      }

      // Determine parent row (the flex container)
      const parentRow = el.dataset && el.dataset.peKey ? (el.parentElement as HTMLElement) : (el as HTMLElement);
      if (!parentRow) return;
      const ph = createFloatingPlaceholder(parentRow);

      // Compute insertion position using all visible sibling cards (excluding dragged)
      const cards = Array.from(parentRow.querySelectorAll('[data-pe-key]')) as HTMLElement[];
      const draggedKey = draggingRef.current?.peKey;
      const visible = cards.filter((c) => (c.dataset.peKey !== draggedKey));
      const parentRect = parentRow.getBoundingClientRect();

      if (visible.length === 0) {
        // empty row -> place at start
        const left = 8;
        ph.style.height = `${Math.max(40, parentRect.height - 8)}px`;
        ph.style.left = `${left}px`;
        ph.style.top = `4px`;
        dragOverRef.current = { peKey: undefined, day, el: parentRow, position: 'end' } as any;
        return;
      }

      // if clientX is 'end', we want after last
        // prefer elementFromPoint when available to detect the exact gap without looping all items
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        const under = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
        const card = under?.closest?.('[data-pe-key]') as HTMLElement | null;
        if (card && parentRow.contains(card) && card.dataset.peKey !== draggingRef.current?.peKey) {
          // if cursor over a card, decide gap relative to that card using prev/next
          const rect = card.getBoundingClientRect();
          const before = clientX < rect.left + rect.width / 2;
          let centerX = 0;
          if (before) {
            // midpoint between previous and this
            let prev = card.previousElementSibling as HTMLElement | null;
            while (prev && !prev.dataset?.peKey) prev = prev.previousElementSibling as HTMLElement | null;
            if (prev) {
              const prevRect = prev.getBoundingClientRect();
              centerX = (prevRect.right + rect.left) / 2;
            } else {
              centerX = rect.left - Math.max(12, rect.width * 0.25);
            }
            const height = Math.max(40, rect.height - 8);
            const left = centerX - parentRect.left;
            const top = rect.top - parentRect.top + 4;
            ph.style.height = `${height}px`;
            ph.style.left = `${left - 1}px`;
            ph.style.top = `${top}px`;
            dragOverRef.current = { peKey: card.dataset.peKey, day, el: card, position: 'before' } as any;
            return;
          } else {
            // after this card
            let next = card.nextElementSibling as HTMLElement | null;
            while (next && !next.dataset?.peKey) next = next.nextElementSibling as HTMLElement | null;
            if (next) {
              const nextRect = next.getBoundingClientRect();
              centerX = (rect.right + nextRect.left) / 2;
            } else {
              centerX = rect.right + Math.max(12, rect.width * 0.25);
            }
            const height = Math.max(40, rect.height - 8);
            const left = centerX - parentRect.left;
            const top = rect.top - parentRect.top + 4;
            ph.style.height = `${height}px`;
            ph.style.left = `${left - 1}px`;
            ph.style.top = `${top}px`;
            dragOverRef.current = { peKey: card.dataset.peKey, day, el: card, position: 'after' } as any;
            return;
          }
        }
      }

      // if clientX equals 'end' or couldn't determine by elementFromPoint, fallback to previous algorithm
      if (clientX === 'end') {
        const lastRect = visible[visible.length - 1].getBoundingClientRect();
        const centerX = lastRect.right + 12;
        const left = centerX - parentRect.left;
        const top = lastRect.top - parentRect.top + 4;
        const height = Math.max(40, lastRect.height - 8);
        ph.style.height = `${height}px`;
        ph.style.left = `${left - 1}px`;
        ph.style.top = `${top}px`;
        dragOverRef.current = { peKey: undefined, day, el: parentRow, position: 'end' } as any;
        return;
      }

      // fallback loop: find the first card whose center is to the right of clientX
      let inserted = false;
      for (let i = 0; i < visible.length; i++) {
        const curr = visible[i];
        const currRect = curr.getBoundingClientRect();
        const currCenter = currRect.left + currRect.width / 2;
        if (typeof clientX === 'number' && clientX < currCenter) {
          // insert before curr
          const prev = i > 0 ? visible[i - 1] : null;
          let centerX = 0;
          if (prev) {
            const prevRect = prev.getBoundingClientRect();
            centerX = (prevRect.right + currRect.left) / 2;
          } else {
            centerX = currRect.left - Math.max(12, currRect.width * 0.25);
          }
          const height = Math.max(40, currRect.height - 8);
          const left = centerX - parentRect.left;
          const top = currRect.top - parentRect.top + 4;
          ph.style.height = `${height}px`;
          ph.style.left = `${left - 1}px`;
          ph.style.top = `${top}px`;
          dragOverRef.current = { peKey: curr.dataset.peKey, day, el: curr, position: 'before' } as any;
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        // insert after last
        const lastRect = visible[visible.length - 1].getBoundingClientRect();
        const centerX = lastRect.right + Math.max(12, lastRect.width * 0.25);
        const left = centerX - parentRect.left;
        const top = lastRect.top - parentRect.top + 4;
        const height = Math.max(40, lastRect.height - 8);
        ph.style.height = `${height}px`;
        ph.style.left = `${left - 1}px`;
        ph.style.top = `${top}px`;
        dragOverRef.current = { peKey: visible[visible.length - 1].dataset.peKey, day, el: visible[visible.length - 1], position: 'after' } as any;
      }
    });
  };

  const onDragOverItem = (e: React.DragEvent, targetPeKey: string, targetDay: string) => {
    e.preventDefault();
    const src = draggingRef.current;
    if (!src) return;
    if (src.day !== targetDay) return; // only allow within same day
    const el = e.currentTarget as HTMLElement;
    // Avoid synchronous layout reads here — delegate positioning to scheduleHighlight (which runs in rAF)
    scheduleHighlight(el, targetPeKey, targetDay, e.clientX, e.clientY);
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (err) {}
  };

  const onDropOnItem = (
    e: React.DragEvent,
    programKey: string,
    targetPeKey: string,
    targetDay: string
  ) => {
    e.preventDefault();
    let src: any;
    try {
      src = JSON.parse(e.dataTransfer.getData('text/plain') || '');
    } catch (err) {
      onDragEnd();
      return;
    }
    const srcKey = src?.peKey;
    const srcDay = src?.day;
    if (!srcKey || srcDay !== targetDay) {
      onDragEnd();
      return;
    }

    const p = programs.find((x) => (x.id ?? x.tempId) === programKey);
    if (!p) {
      onDragEnd();
      return;
    }

    const items = (p.programExercises || [])
      .filter((pe: any) => String(pe.day ?? 'A') === String(targetDay))
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    const srcIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === srcKey);
    const targetIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === targetPeKey);
    if (srcIdx === -1 || targetIdx === -1) {
      onDragEnd();
      return;
    }

    const moved = items.splice(srcIdx, 1)[0];

    // Prefer the placeholder info stored in dragOverRef if available
    const dr = dragOverRef.current as any;
    if (dr && dr.peKey) {
      const targetIdx2 = items.findIndex((it: any) => (it.id ?? it.tempId) === dr.peKey);
      const insertIdx2 = dr.position === 'after' ? targetIdx2 + 1 : targetIdx2;
      if (targetIdx2 === -1) {
        // fallback to targetIdx
        const pos = dr?.position === 'after' ? targetIdx + 1 : targetIdx;
        items.splice(pos, 0, moved);
      } else {
        items.splice(insertIdx2, 0, moved);
      }
    } else {
      // Fallback: determine side using target element rect (rare but safe)
      try {
        const targetEl = (e.target as HTMLElement)?.closest?.('[data-pe-key]') as HTMLElement | null;
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          const side = (e.clientX ?? rect.left + rect.width / 2) < rect.left + rect.width / 2 ? 'before' : 'after';
          const insertIdx = side === 'after' ? targetIdx + 1 : targetIdx;
          items.splice(insertIdx, 0, moved);
        } else {
          // as a final fallback, append
          items.push(moved);
        }
      } catch (err) {
        items.push(moved);
      }
    }

    const merged = (p.programExercises || []).map((pe: any) => {
      const match = items.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
      return match ? { ...pe, position: items.indexOf(match) } : pe;
    });

    updateProgramExercisesPositions(programKey, merged);
    onDragEnd();
  };

  const onDragOverContainer = (e: React.DragEvent, targetDay: string) => {
    e.preventDefault();
    const src = draggingRef.current;
    if (!src) return;
    if (src.day !== targetDay) return;
    const el = e.currentTarget as HTMLElement;

    // If pointer is over a card, let card handler decide (avoid overriding)
    const under = (e.target as HTMLElement)?.closest?.('[data-pe-key]') as HTMLElement | null;
    if (under) {
      return; // card handler will run
    }

    // if already highlighted same container at end, skip
    if (dragOverRef.current?.el === el && dragOverRef.current?.position === 'end') return;
    // pass clientX so we can compute insertion point relative to row items
    scheduleHighlight(el, undefined, targetDay, e.clientX, e.clientY);
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (err) {}
  };

  const onDropOnContainerEnd = (e: React.DragEvent, programKey: string, targetDay: string) => {
    e.preventDefault();
    let src: any;
    try {
      src = JSON.parse(e.dataTransfer.getData('text/plain') || '');
    } catch (err) {
      onDragEnd();
      return;
    }
    const srcKey = src?.peKey;
    const srcDay = src?.day;
    if (!srcKey || srcDay !== targetDay) {
      onDragEnd();
      return;
    }

    const p = programs.find((x) => (x.id ?? x.tempId) === programKey);
    if (!p) {
      onDragEnd();
      return;
    }

    const items = (p.programExercises || [])
      .filter((pe: any) => String(pe.day ?? 'A') === String(targetDay))
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    const srcIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === srcKey);
    if (srcIdx === -1) {
      onDragEnd();
      return;
    }

    const moved = items.splice(srcIdx, 1)[0];

    // Decide insertion index based on the floating placeholder info (dragOverRef)
    const dr = dragOverRef.current as any;
    if (dr && dr.peKey) {
      const targetIdx = items.findIndex((it: any) => (it.id ?? it.tempId) === dr.peKey);
      const insertIdx = dr.position === 'after' ? targetIdx + 1 : targetIdx;
      if (targetIdx === -1) {
        // fallback to append
        items.push(moved);
      } else {
        items.splice(insertIdx, 0, moved);
      }
    } else if (dr && dr.position === 'end') {
      items.push(moved);
    } else {
      // Fallback: try to use e.clientX to find nearest spot within the same container
      try {
        const parentRow = (e.currentTarget as HTMLElement) || null;
        const cards = Array.from(parentRow?.querySelectorAll('[data-pe-key]') || []) as HTMLElement[];
        const visible = cards.filter((c) => c.dataset.peKey !== draggingRef.current?.peKey);
        let inserted = false;
        for (let i = 0; i < visible.length; i++) {
          const currRect = visible[i].getBoundingClientRect();
          const center = currRect.left + currRect.width / 2;
          if ((e.clientX ?? 0) < center) {
            items.splice(i, 0, moved);
            inserted = true;
            break;
          }
        }
        if (!inserted) items.push(moved);
      } catch (err) {
        items.push(moved);
      }
    }

    const merged = (p.programExercises || []).map((pe: any) => {
      const match = items.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
      return match ? { ...pe, position: items.indexOf(match) } : pe;
    });

    updateProgramExercisesPositions(programKey, merged);
    onDragEnd();
  };

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

            <div className="rounded-xl border bg-background overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px] sm:w-[140px]">Nombre</TableHead>
                    <TableHead className="w-[160px] sm:w-[60%]">Descripción</TableHead>
                    <TableHead className="w-[80px] text-left">Días</TableHead>
                    <TableHead className="w-[100px] text-left">Ejercicios</TableHead>
                    <TableHead className="pr-4 w-[120px] text-left">Acciones</TableHead>
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
                        <TableCell className="w-[160px] sm:w-[60%]">
                          {descriptionText ? (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block max-w-[160px] sm:max-w-[820px] truncate overflow-hidden whitespace-nowrap text-muted-foreground">
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
                        <TableCell className="">{daysCount}</TableCell>
                        <TableCell className="">{exercisesCount}</TableCell>
                        <TableCell className="pr-4">
                          <div className="flex justify-start gap-2">
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
                        id="editing-program-name"
                        name="editingProgramName"
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
                          id={`program-desc-${p.id ?? p.tempId}`}
                          value={p.description || ''}
                          onChange={
                            isClient
                              ? () => { }
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
                        <input type="hidden" name="description" value={p.description || ''} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasPendingChanges && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            resetToInitial();
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={async () => {
                            try {
                              setSavingProgram(true);
                              await persistProgram(p.id ?? p.tempId);
                              notifySaved('Cambios guardados');
                            } catch (err) {
                              logError('Error saving program', err);
                            } finally {
                              setSavingProgram(false);
                            }
                          }}
                          disabled={savingProgram}
                        >
                          {savingProgram ? 'Guardando...' : 'Guardar'}
                        </Button>
                      </>
                    )}

                    <Button variant="outline" onClick={() => setViewingProgramId(null)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Volver
                    </Button>
                  </div>
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

                          >

                            <div className="flex items-center justify-between mb-2">
                              <div
                                className={cn(
                                  'text-sm font-medium pl-2',
                                  'cursor-default flex-1'
                                )}
                                tabIndex={0}
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
                              <div
                                onDragOver={(e) => onDragOverContainer(e, day)}
                                onDrop={(e) => onDropOnContainerEnd(e, p.id ?? p.tempId, day)}
                                className="relative flex flex-row gap-4 overflow-x-auto overflow-y-hidden pb-2 px-2 w-full max-w-full min-w-0"
                              >
                                {items.map((pe: any, i: number) => {
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

                                  return (
                                    <React.Fragment key={pe.id || pe.tempId}>
                                      <div
                                        key={pe.id || pe.tempId}
                                        draggable={!isClient}
                                        onDragStart={(e) => onDragStart(e, pe.id ?? pe.tempId, day)}
                                        onDragEnd={() => onDragEnd()}
                                        onDragOver={(e) => onDragOverItem(e, pe.id ?? pe.tempId, day)}
                                        onDrop={(e) => onDropOnItem(e, p.id ?? p.tempId, pe.id ?? pe.tempId, day)}
                                        className="relative w-[260px] flex-none"
                                        data-pe-key={pe.id ?? pe.tempId}
                                        data-day={day}
                                        data-index={i}
                                      >

                                        <div className="relative">
                                          <Card
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && !isClient) {
                                                setEditingProgramExercise(pe);
                                                setShowEditProgramExerciseDialog(true);
                                              }
                                            }}
                                            className={cn(
                                              'overflow-hidden hover:shadow-lg transition-shadow h-[300px] w-full flex flex-col min-w-0',
                                              'bg-white rounded-lg border',
                                              'cursor-default'
                                            )}
                                          >
                                            <CardHeader className="py-1 px-4 h-auto space-y-0.5">
                                              <div className="flex items-center justify-between gap-2">
                                                <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">
                                                  <div className="flex items-center gap-2">

                                                    <span className="flex-1 line-clamp-2">
                                                      <span className="flex items-center gap-2">
                                                        <span className="truncate">
                                                          {exercise.name || pe.exercise?.name || 'Ejercicio'}
                                                        </span>
                                                        <TooltipProvider delayDuration={150}>
                                                          <Tooltip>
                                                            <TooltipTrigger asChild>
                                                              <span className="text-muted-foreground cursor-default" aria-label="Notas del ejercicio">
                                                                <HelpCircle className="h-4 w-4" />
                                                              </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                                                              <div className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words text-sm" dangerouslySetInnerHTML={{
                                                                __html: pe.notes && String(pe.notes).trim() ? DOMPurify.sanitize(pe.notes, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'br', 'p'], ALLOWED_ATTR: [], }) : 'Sin notas',
                                                              }} />
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
                                              <div className="absolute inset-0 w-full h-full">
                                                <ResolvedMedia
                                                  bucket="exercise_videos"
                                                  id={exercise.id}
                                                  filename={file}
                                                  className="absolute inset-0 w-full h-full object-cover cursor-auto"
                                                  controls
                                                  onMouseDown={(e) => e.stopPropagation()}
                                                  onPointerDown={(e) => e.stopPropagation()}
                                                />
                                              </div>
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
                                    </React.Fragment>
                                  );
                                })}

                                {/* Placeholder card to add a new exercise */}
                                {!isClient && (
                                  <div
                                    key="add-placeholder"
                                    className="relative w-[260px] flex-none"
                                  >

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
                id="cp-exercise-search"
                name="cpExerciseSearch"
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
                        id="cp-equipment-search"
                        name="cpEquipmentSearch"
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
                        id="cp-anatomy-search"
                        name="cpAnatomySearch"
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
                              ) : file ? (
                                <div className="relative w-full h-full">
                                  <ResolvedMedia
                                    bucket="exercise_videos"
                                    id={ex.id}
                                    filename={file}
                                    className="w-full h-auto object-cover aspect-video cursor-auto"
                                    controls
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  />
                                </div>
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
