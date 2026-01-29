import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  supabase,
  getFilePublicUrl,
  getAuthToken,
  uploadVideoWithCompression,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, Plus, Trash, Image as ImageIcon, ChevronDown, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import ActionButton from '@/components/ui/ActionButton';
import { normalizeForSearch } from '@/lib/stringUtils';
import { error as logError } from '@/lib/logger';
import './ejercicios.css';

interface Exercise {
  id: string;
  name: string;
  description: string;
  file: string;
  company: string;
  equipment: string[];
  anatomy: string[];
  created: string;
  updated: string;
}

interface AnatomyRecord {
  id: string;
  name: string;
}

interface EquipmentRecord {
  id: string;
  name: string;
}

interface ExerciseDialogProps {
  exercise: Exercise | null;
  anatomy: AnatomyRecord[];
  equipment: EquipmentRecord[];
  onSuccess: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ExerciseDialog({
  exercise,
  anatomy,
  equipment,
  onSuccess,
  trigger,
  open: openProp,
  onOpenChange,
}: ExerciseDialogProps) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = typeof openProp !== 'undefined' ? openProp : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAnatomy, setSelectedAnatomy] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [removeExistingFile, setRemoveExistingFile] = useState(false);

  // Inline creation state

  // Autofocus removed per UX decision
  const [anatomySearch, setAnatomySearch] = useState('');
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [creatingAnatomy] = useState(false);
  const [creatingEquipment] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [localAnatomy, setLocalAnatomy] = useState<AnatomyRecord[]>(anatomy);
  const [localEquipment, setLocalEquipment] = useState<EquipmentRecord[]>(equipment);

  // Pending inline creations that will be created on save (tmpId,name)
  const [pendingAnatomy, setPendingAnatomy] = useState<Array<{ tmpId: string; name: string }>>([]);
  const [pendingEquipment, setPendingEquipment] = useState<Array<{ tmpId: string; name: string }>>(
    []
  );

  // Filter anatomy and equipment based on search
  const filteredAnatomy = useMemo(() => {
    if (!anatomySearch) return localAnatomy;
    return localAnatomy.filter((a) =>
      normalizeForSearch(a.name).includes(normalizeForSearch(anatomySearch))
    );
  }, [localAnatomy, anatomySearch]);

  const filteredEquipment = useMemo(() => {
    if (!equipmentSearch) return localEquipment;
    return localEquipment.filter((e) =>
      normalizeForSearch(e.name).includes(normalizeForSearch(equipmentSearch))
    );
  }, [localEquipment, equipmentSearch]);

  // Check if anatomy/equipment creation option should show
  const showCreateAnatomy =
    anatomySearch &&
    !localAnatomy.some((a) => a.name.toLowerCase() === anatomySearch.toLowerCase()) &&
    !creatingAnatomy;

  const showCreateEquipment =
    equipmentSearch &&
    !localEquipment.some((e) => e.name.toLowerCase() === equipmentSearch.toLowerCase()) &&
    !creatingEquipment;

  // Initialize form with exercise data
  useEffect(() => {
    setLocalAnatomy(anatomy);
    setLocalEquipment(equipment);
    setPendingAnatomy([]);
    setPendingEquipment([]);
    if (exercise) {
      setName(exercise.name);
      setDescription(exercise.description || '');
      setSelectedAnatomy(exercise.anatomy || []);
      setSelectedEquipment(exercise.equipment || []);
      if (exercise.file) {
        // Try public URL first, otherwise ask server for a signed URL
        let preview = getFilePublicUrl('exercise_videos', exercise.id, exercise.file) || '';
        if (!preview) {
          (async () => {
            try {
              const fnUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/get-signed-url`;
              const token = await getAuthToken();
              const res = await fetch(fnUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
                body: JSON.stringify({ bucket: 'exercise_videos', path: exercise.file, expires: 60 * 60 }),
              });
              if (res.ok) {
                const j = await res.json().catch(() => null);
                preview = j?.signedUrl || preview;
              }
            } catch {
              // ignore
            }
            // Ensure we set preview after trying to fetch signed url
            setImagePreview(preview || '');
            setRemoveExistingFile(false);
          })();
        } else {
          setImagePreview(preview || '');
          setRemoveExistingFile(false);
        }
      }
    } else {
      resetForm();
    }
  }, [exercise, open, anatomy, equipment]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedAnatomy([]);
    setSelectedEquipment([]);
    setImageFile(null);
    setImagePreview('');
    setRemoveExistingFile(false);
    setAnatomySearch('');
    setEquipmentSearch('');
    setPendingAnatomy([]);
    setPendingEquipment([]);
    setError('');
  };

  // Inline create anatomy - mark as pending to create on save
  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const handleCreateAnatomy = () => {
    const name = capitalize(anatomySearch.trim());
    if (!name || !user?.company) return;
    // create a temporary id for pending anatomy
    const tmpId = `pendingA:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const pendingItem = { id: tmpId, name } as any;
    setLocalAnatomy((prev) => [...prev, pendingItem]);
    setSelectedAnatomy((prev) => [...prev, tmpId]);
    setPendingAnatomy((prev) => [...prev, { tmpId, name }]);
    setAnatomySearch('');
  };

  // Inline create equipment - mark as pending to create on save
  const handleCreateEquipment = () => {
    const name = capitalize(equipmentSearch.trim());
    if (!name || !user?.company) return;
    const tmpId = `pendingE:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const pendingItem = { id: tmpId, name } as any;
    setLocalEquipment((prev) => [...prev, pendingItem]);
    setSelectedEquipment((prev) => [...prev, tmpId]);
    setPendingEquipment((prev) => [...prev, { tmpId, name }]);
    setEquipmentSearch('');
  };

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setRemoveExistingFile(false);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setImagePreview(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validate form (name presence is enforced by disabling the Save button)
  const validateForm = (): boolean => {
    return true;
  };

  // Helper: create pending rows (anatomy/equipment), using service function as fallback
  const createPendingRows = async (
    table: 'anatomy' | 'equipment',
    pending: Array<{ tmpId: string; name: string }>,
    selectedIds: string[]
  ) => {
    if (!pending || pending.length === 0) return {} as Record<string, string>;
    const mapping: Record<string, string> = {};
    // only create pending items that are still selected
    const toCreate = pending.filter((p) => selectedIds.includes(p.tmpId));
    for (const p of toCreate) {
      try {
        const { data: created, error } = await supabase
          .from(table)
          .insert({ name: p.name, company: user!.company })
          .select()
          .single();
        if (error) throw error;
        mapping[p.tmpId] = created.id;
        if (table === 'anatomy') {
          setLocalAnatomy((prev) => prev.map((x) => (x.id === p.tmpId ? created : x)));
        } else {
          setLocalEquipment((prev) => prev.map((x) => (x.id === p.tmpId ? created : x)));
        }
      } catch (err: any) {
        // No Edge Function fallback available (previously used `create-company-row`);
        // Surface the error and set mapping empty so UI can continue gracefully.
        logError('createPendingRows: insert failed and Edge Function fallback is removed', { p, err });
        mapping[p.tmpId] = '';
      }
    }
    return mapping;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm() || !user?.company) return;

    setLoading(true);
    try {
      // First, create any pending anatomy/equipment and resolve temporary ids to real ids
      const anatMap = await createPendingRows('anatomy', pendingAnatomy, selectedAnatomy);
      const equipMap = await createPendingRows('equipment', pendingEquipment, selectedEquipment);
      const resolveSelected = (arr: string[]) =>
        arr
          .map((id) => {
            if (id.startsWith('pendingA:')) return anatMap[id] || null;
            if (id.startsWith('pendingE:')) return equipMap[id] || null;
            return id;
          })
          .filter((x) => !!x) as string[];
      const finalAnatomy = resolveSelected(selectedAnatomy);
      const finalEquipment = resolveSelected(selectedEquipment);

      if (exercise) {
        // Update metadata immediately (do not await file upload)
        const { error: updateErr } = await supabase
          .from('exercises')
          .update({
            name: name.trim(),
            description: description.trim(),
            company: user.company,
            anatomy: finalAnatomy,
            equipment: finalEquipment,
            ...(removeExistingFile ? { file: null as any } : {}),
          })
          .eq('id', exercise.id);
        if (updateErr) throw updateErr;

        // Fetch updated exercise row to dispatch to listeners
        try {
          const { data: updatedRow, error: fetchErr } = await supabase
            .from('exercises')
            .select('*')
            .eq('id', exercise.id)
            .maybeSingle();
          if (!fetchErr && updatedRow) {
            try {
              window.dispatchEvent(new CustomEvent('exercise-updated', { detail: updatedRow }));
            } catch { }
          }
        } catch {
          /* non-fatal */
        }

        // If there's a new file, upload it in background so the UI doesn't hang.
        if (imageFile) {
          // Ensure the provided file is a video to avoid storing logos in exercise bucket
          if (imageFile.type && !imageFile.type.toLowerCase().startsWith('video/')) {
            setError('El archivo seleccionado no es un vídeo. Selecciona un archivo de tipo video/*');
            try {
              window.dispatchEvent(
                new CustomEvent('exercise-upload-end', { detail: { exerciseId: exercise.id, success: false, error: 'invalid_type' } })
              );
            } catch { }
            return;
          }

          const exerciseId = exercise.id;
          const filenameOnly = imageFile.name;
          (async () => {
            try {
              // Notify UI that upload started
              try {
                window.dispatchEvent(
                  new CustomEvent('exercise-upload-start', { detail: { exerciseId } })
                );
              } catch { }
              // Upload to exercise-prefixed path: use a unique filename to avoid overwrite/permission issues
              const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              // sanitize filename to remove accents and unsafe characters
              const { sanitizeFilename } = await import('@/lib/stringUtils');
              const safeFilename = sanitizeFilename(filenameOnly);
              const uploadPath = `${exerciseId}/${uniquePrefix}-${safeFilename}`;

              // Add a total upload timeout so we never wait indefinitely (4 minutes)
              let uploadResult: any;
              try {
                uploadResult = await Promise.race([
                  uploadVideoWithCompression('exercise_videos', uploadPath, imageFile, { upsert: false }),
                  new Promise((_, rej) =>
                    setTimeout(() => rej(new Error('upload total timed out')), 4 * 60_000)
                  ),
                ]);
              } catch (err) {
                logError('backgroundUploadEdit: upload failed or timed out', err);
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: {
                        exerciseId,
                        success: false,
                        error: String((err as any)?.message ?? err),
                      },
                    })
                  );
                } catch { }
                setError(
                  'El archivo no se pudo subir. El ejercicio fue actualizado sin nuevo video.'
                );
                return;
              }

              const { data: uploadData, error: upErr } = uploadResult || {};
              if (upErr) {
                logError('backgroundUploadEdit: upload failed', upErr);
                setError(
                  'El archivo no se pudo subir. El ejercicio fue actualizado sin nuevo video.'
                );
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: { exerciseId, success: false, error: String(upErr) },
                    })
                  );
                } catch { }
                return;
              }
              // Use returned path if provided (edge function may store at root)
              const returnedPath =
                (uploadData && (uploadData.path || uploadData.uploaded?.path)) || uploadPath;
              const { error: updateFileErr } = await supabase
                .from('exercises')
                .update({ file: returnedPath })
                .eq('id', exerciseId);
              if (updateFileErr) {
                logError(
                  'backgroundUploadEdit: failed to update record with file path',
                  updateFileErr
                );
                setError(
                  'El archivo se subió, pero no se pudo actualizar la referencia en la base de datos.'
                );
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: { exerciseId, success: false, error: String(updateFileErr) },
                    })
                  );
                } catch { }
              } else {
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: { exerciseId, success: true, filename: returnedPath },
                    })
                  );
                } catch { }
              }
            } catch (bgErr) {
              logError('backgroundUploadEdit: unexpected error', bgErr);
              setError('Error al subir el archivo en segundo plano.');
              try {
                window.dispatchEvent(
                  new CustomEvent('exercise-upload-end', {
                    detail: {
                      exerciseId,
                      success: false,
                      error: String((bgErr as any)?.message ?? bgErr),
                    },
                  })
                );
              } catch { }
            }
          })();
        }
      } else {
        // Create row first
        const { data: newEx, error: createErr } = await supabase
          .from('exercises')
          .insert({
            name: name.trim(),
            description: description.trim(),
            company: user.company,
            anatomy: finalAnatomy,
            equipment: finalEquipment,
          })
          .select()
          .single();
        if (createErr) throw createErr;

        // Dispatch created exercise to listeners so UI can update
        try {
          window.dispatchEvent(new CustomEvent('exercise-updated', { detail: newEx }));
        } catch { }

        // If there's a file, upload it in background so the UI doesn't hang.
        if (imageFile) {
          // Ensure the provided file is a video to avoid storing logos in exercise bucket
          if (imageFile.type && !imageFile.type.toLowerCase().startsWith('video/')) {
            setError('El archivo seleccionado no es un vídeo. Selecciona un archivo de tipo video/*');
            try {
              window.dispatchEvent(
                new CustomEvent('exercise-upload-end', { detail: { exerciseId: newEx.id, success: false, error: 'invalid_type' } })
              );
            } catch { }
            return;
          }

          const exerciseId = newEx.id;
          const filenameOnly = imageFile.name;
          (async () => {
            try {
              // Notify UI that upload started
              try {
                window.dispatchEvent(
                  new CustomEvent('exercise-upload-start', { detail: { exerciseId } })
                );
              } catch { }
              // Upload to exercise-prefixed path with a unique filename
              const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              // sanitize filename to remove accents and unsafe characters
              const { sanitizeFilename } = await import('@/lib/stringUtils');
              const safeFilename = sanitizeFilename(filenameOnly);
              const uploadPath = `${exerciseId}/${uniquePrefix}-${safeFilename}`;

              // Add a total upload timeout so we never wait indefinitely (4 minutes)
              let uploadResult: any;
              try {
                uploadResult = await Promise.race([
                  uploadVideoWithCompression('exercise_videos', uploadPath, imageFile),
                  new Promise((_, rej) =>
                    setTimeout(() => rej(new Error('upload total timed out')), 4 * 60_000)
                  ),
                ]);
              } catch (err) {
                logError('backgroundUpload: upload failed or timed out', err);
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: {
                        exerciseId,
                        success: false,
                        error: String((err as any)?.message ?? err),
                      },
                    })
                  );
                } catch { }
                setError('El archivo no se pudo subir. El ejercicio fue creado sin video.');
                return;
              }

              const { data: uploadData, error: upErr } = uploadResult || {};
              if (upErr) {
                // If RLS or other error, attempt edge function fallback already handled inside uploadVideoWithCompression
                logError('backgroundUpload: upload failed', upErr);
                // Notify user in a non-blocking way
                setError('El archivo no se pudo subir. El ejercicio fue creado sin video.');
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: { exerciseId, success: false, error: String(upErr) },
                    })
                  );
                } catch { }
                return;
              }
              // Prefer returned path from the upload (may include exerciseId prefix)
              const filename = uploadPath;
              const resolvedPath =
                (uploadData && (uploadData.path || uploadData.uploaded?.path)) || filename;
              const { error: updateErr } = await supabase
                .from('exercises')
                .update({ file: resolvedPath })
                .eq('id', exerciseId);
              if (updateErr) {
                logError('backgroundUpload: failed to update record with file path', updateErr);
                setError(
                  'El archivo se subió, pero no se pudo actualizar la referencia en la base de datos.'
                );
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: {
                        exerciseId,
                        success: false,
                        error: String(updateErr?.message ?? updateErr),
                      },
                    })
                  );
                } catch { }
              } else {
                try {
                  window.dispatchEvent(
                    new CustomEvent('exercise-upload-end', {
                      detail: { exerciseId, success: true, filename: resolvedPath },
                    })
                  );
                } catch { }
              }
            } catch (bgErr) {
              logError('backgroundUpload: unexpected error', bgErr);
              setError('Error al subir el archivo en segundo plano.');
              try {
                window.dispatchEvent(
                  new CustomEvent('exercise-upload-end', {
                    detail: { exerciseId, success: false, error: String(bgErr) },
                  })
                );
              } catch { }
            }
          })();
        }
      }

      // Clear pending markers and ensure selected lists reflect created ids
      setPendingAnatomy([]);
      setPendingEquipment([]);
      setSelectedAnatomy(finalAnatomy);
      setSelectedEquipment(finalEquipment);

      setOpen(false);
      resetForm();
      onSuccess();
    } catch (err: any) {
      logError('Error saving exercise:', err);
      setError('Error al guardar el ejercicio: ' + (err?.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!exercise?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('exercises').delete().eq('id', exercise.id);
      if (error) throw error;
      try {
        if (exercise.file) {
          const pathToRemove = exercise.file.includes('/')
            ? exercise.file
            : `${exercise.id}/${exercise.file}`;
          await supabase.storage.from('exercise_videos').remove([pathToRemove]);
        }
      } catch {
        /* ignore storage removal errors */
      }
      setShowDeleteDialog(false);
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (err: any) {
      logError('Error deleting exercise:', err);
      alert(`Error al eliminar el ejercicio: ${err?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && onOpenChange ? (
          // Controlled usage: render trigger that opens via onOpenChange
          React.isValidElement(trigger) ? (
            React.cloneElement(trigger as any, { onClick: () => onOpenChange(true) })
          ) : (
            trigger
          )
        ) : // Uncontrolled usage: let the trigger open the internal dialog
          trigger ? (
            <DialogTrigger asChild>{trigger}</DialogTrigger>
          ) : null}
        <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0">
          <div className="px-6 pt-6">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl">
                {exercise ? 'Editar Ejercicio' : 'Crear Ejercicio'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {exercise
                  ? 'Modifica los datos del ejercicio'
                  : 'Completa los datos del nuevo ejercicio'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6">
            <div className="space-y-6">
              {error && (
                <Alert className="border-destructive/50 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del ejercicio *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Flexiones, dominadas, etc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  ref={(el: HTMLInputElement) => (nameInputRef.current = el)}
                />
              </div>

              {/* Video */}
              <div className="space-y-2">
                <Label htmlFor="exercise-file">Video</Label>
                {imagePreview ? (
                  <div className="relative w-40 h-72 bg-slate-100 rounded-lg overflow-hidden">
                    <video src={imagePreview} className="w-full h-full object-cover" controls />
                    <ActionButton
                      tooltip="Eliminar video"
                      aria-label="Eliminar video"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                        if (exercise?.file) setRemoveExistingFile(true);
                      }}
                      className="absolute top-2 right-2 p-0 bg-[hsl(var(--muted))] transition-none"
                    >
                      <Trash className="h-4 w-4" />
                    </ActionButton>
                  </div>
                ) : (
                  <div
                    className={`w-full border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors p-8 text-center group exercise-drag-overlay ${dragOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setRemoveExistingFile(false);
                        const reader = new FileReader();
                        reader.onload = (evt) => setImagePreview(evt.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    <label className="w-full flex flex-col items-center justify-center cursor-pointer">
                      <input
                        id="exercise-file"
                        name="exerciseFile"
                        type="file"
                        accept="video/*"
                        onChange={handleImageChange}
                        className="hidden"
                        disabled={loading}
                      />
                      <ImageIcon className="h-8 w-8 mx-auto text-slate-400 mb-2 group-hover:text-slate-500 transition-colors" />
                      <p className="text-sm text-slate-600 group-hover:text-slate-700 transition-colors">
                        Arrastra y suelta video aquí
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        o haz clic para seleccionar (mp4, mov, webm)
                      </p>
                    </label>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Instrucciones, forma correcta, notas importantes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  rows={3}
                />
              </div>

              {/* Equipamiento + Anatomía side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Equipamiento */}
                <div className="space-y-2">
                  <Label htmlFor="equipmentSearch">Equipamiento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left gap-1">
                        <Plus className="h-4 w-4" />
                        <span>Equipamiento</span>
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="popover-content-width p-2" align="start">
                      <div className="space-y-1">
                        <Input
                          id="equipmentSearch"
                          name="equipmentSearch"
                          placeholder="Buscar o crear equipamiento..."
                          value={equipmentSearch}
                          onChange={(e) => setEquipmentSearch(e.target.value)}
                        />
                        <div
                          className="space-y-1 max-h-48 overflow-y-auto"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          {filteredEquipment.map((e) => (
                            <label
                              key={e.id}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={selectedEquipment.includes(e.id)}
                                onCheckedChange={(checked) => {
                                  const isChecked = Boolean(checked);
                                  if (isChecked) setSelectedEquipment((prev) => [...prev, e.id]);
                                  else
                                    setSelectedEquipment((prev) =>
                                      prev.filter((id) => id !== e.id)
                                    );
                                  setEquipmentSearch('');
                                }}
                              />
                              <span
                                className={selectedEquipment.includes(e.id) ? 'font-medium' : ''}
                              >
                                {e.name}
                              </span>
                            </label>
                          ))}
                          {showCreateEquipment && (
                            <button
                              onClick={handleCreateEquipment}
                              disabled={creatingEquipment}
                              className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 text-sm disabled:opacity-50"
                            >
                              {creatingEquipment ? (
                                'Creando...'
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 inline mr-1" />
                                  Crear "{equipmentSearch}"
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedEquipment.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedEquipment.map((id) => {
                        const e = localEquipment.find((x) => x.id === id);
                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 border-blue-200"
                          >
                            {e?.name}
                            <button
                              onClick={() =>
                                setSelectedEquipment(selectedEquipment.filter((i) => i !== id))
                              }
                              className="ml-1 hover:text-red-600"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Anatomía */}
                <div className="space-y-2">
                  <Label htmlFor="anatomySearch">Anatomía</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left gap-1">
                        <Plus className="h-4 w-4" />
                        <span>Anatomía</span>
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="popover-content-width p-2" align="start">
                      <div className="space-y-1">
                        <Input
                          id="anatomySearch"
                          name="anatomySearch"
                          placeholder="Buscar o crear anatomía..."
                          value={anatomySearch}
                          onChange={(e) => setAnatomySearch(e.target.value)}
                        />
                        <div
                          className="space-y-1 max-h-48 overflow-y-auto"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          {filteredAnatomy.map((a) => (
                            <label
                              key={a.id}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={selectedAnatomy.includes(a.id)}
                                onCheckedChange={(checked) => {
                                  const isChecked = Boolean(checked);
                                  if (isChecked) setSelectedAnatomy((prev) => [...prev, a.id]);
                                  else
                                    setSelectedAnatomy((prev) => prev.filter((id) => id !== a.id));
                                  setAnatomySearch('');
                                }}
                              />
                              <span className={selectedAnatomy.includes(a.id) ? 'font-medium' : ''}>
                                {a.name}
                              </span>
                            </label>
                          ))}
                          {showCreateAnatomy && (
                            <button
                              onClick={handleCreateAnatomy}
                              disabled={creatingAnatomy}
                              className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 text-sm disabled:opacity-50"
                            >
                              {creatingAnatomy ? (
                                'Creando...'
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 inline mr-1" />
                                  Crear "{anatomySearch}"
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedAnatomy.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedAnatomy.map((id) => {
                        const a = localAnatomy.find((x) => x.id === id);
                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="bg-orange-100 text-orange-800 border-orange-200"
                          >
                            {a?.name}
                            <button
                              onClick={() =>
                                setSelectedAnatomy(selectedAnatomy.filter((i) => i !== id))
                              }
                              className="ml-1 hover:text-red-600"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex w-full justify-between pt-4 border-t px-6 py-6 bg-white">
            <div>
              {exercise?.id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={loading}
                >
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading || !name.trim()}>
                {loading ? (
                  <>
                    Guardando
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ejercicio?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
