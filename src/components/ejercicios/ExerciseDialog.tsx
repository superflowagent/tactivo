import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, Plus, Trash, Image as ImageIcon, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import ActionButton from "@/components/ui/ActionButton";
import { shouldAutoFocus } from "@/lib/utils";
import { error as logError } from "@/lib/logger";
import "./ejercicios.css";

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
    const [error, setError] = useState("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Form state
    const nameInputRef = useRef<HTMLInputElement | null>(null)
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedAnatomy, setSelectedAnatomy] = useState<string[]>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [removeExistingFile, setRemoveExistingFile] = useState(false);

    // Inline creation state

    useEffect(() => {
        if (open && shouldAutoFocus()) {
            setTimeout(() => {
                nameInputRef.current?.focus()
            }, 50)
        }
    }, [open])
    const [anatomySearch, setAnatomySearch] = useState("");
    const [equipmentSearch, setEquipmentSearch] = useState("");
    const [creatingAnatomy, setCreatingAnatomy] = useState(false);
    const [creatingEquipment, setCreatingEquipment] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [localAnatomy, setLocalAnatomy] = useState<AnatomyRecord[]>(anatomy);
    const [localEquipment, setLocalEquipment] = useState<EquipmentRecord[]>(equipment);

    // Filter anatomy and equipment based on search
    const filteredAnatomy = useMemo(() => {
        if (!anatomySearch) return localAnatomy;
        return localAnatomy.filter((a) =>
            a.name.toLowerCase().includes(anatomySearch.toLowerCase())
        );
    }, [localAnatomy, anatomySearch]);

    const filteredEquipment = useMemo(() => {
        if (!equipmentSearch) return localEquipment;
        return localEquipment.filter((e) =>
            e.name.toLowerCase().includes(equipmentSearch.toLowerCase())
        );
    }, [localEquipment, equipmentSearch]);

    // Check if anatomy/equipment creation option should show
    const showCreateAnatomy =
        anatomySearch &&
        !localAnatomy.some(
            (a) => a.name.toLowerCase() === anatomySearch.toLowerCase()
        ) &&
        !creatingAnatomy;

    const showCreateEquipment =
        equipmentSearch &&
        !localEquipment.some(
            (e) => e.name.toLowerCase() === equipmentSearch.toLowerCase()
        ) &&
        !creatingEquipment;

    // Initialize form with exercise data
    useEffect(() => {
        setLocalAnatomy(anatomy);
        setLocalEquipment(equipment);
        if (exercise) {
            setName(exercise.name);
            setDescription(exercise.description || "");
            setSelectedAnatomy(exercise.anatomy || []);
            setSelectedEquipment(exercise.equipment || []);
            if (exercise.file) {
                setImagePreview(pb.files.getUrl(exercise, exercise.file));
                setRemoveExistingFile(false);
            }
        } else {
            resetForm();
        }
    }, [exercise, open, anatomy, equipment]);

    const resetForm = () => {
        setName("");
        setDescription("");
        setSelectedAnatomy([]);
        setSelectedEquipment([]);
        setImageFile(null);
        setImagePreview("");
        setRemoveExistingFile(false);
        setAnatomySearch("");
        setEquipmentSearch("");
        setError("");
    };

    // Inline create anatomy
    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

    // Delete equipment/anatomy
    const handleDeleteEquipment = async (id: string) => {
        if (!confirm('¿Eliminar equipamiento? Esta acción no se puede deshacer.')) return;
        setLoading(true);
        try {
            await pb.collection('equipment').delete(id);
            setLocalEquipment(prev => prev.filter(x => x.id !== id));
            setEquipment(prev => prev.filter(x => x.id !== id));
            setSelectedEquipment(prev => prev.filter(i => i !== id));
            setEquipmentSearch("");
        } catch (err: any) {
            logError('Error deleting equipment:', err);
            setError('Error al eliminar equipamiento');
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteAnatomy = async (id: string) => {
        if (!confirm('¿Eliminar anatomía? Esta acción no se puede deshacer.')) return;
        setLoading(true);
        try {
            await pb.collection('anatomy').delete(id);
            setLocalAnatomy(prev => prev.filter(x => x.id !== id));
            setAnatomy(prev => prev.filter(x => x.id !== id));
            setSelectedAnatomy(prev => prev.filter(i => i !== id));
            setAnatomySearch("");
        } catch (err: any) {
            logError('Error deleting anatomy:', err);
            setError('Error al eliminar anatomía');
        } finally {
            setLoading(false);
        }
    }

    const handleCreateAnatomy = async () => {
        if (!user?.company) return;
        setCreatingAnatomy(true);

        try {
            const newAnatomy = await pb.collection("anatomy").create({
                name: capitalize(anatomySearch.trim()),
                company: user.company,
            });
            setLocalAnatomy((prev) => [...prev, newAnatomy as any]);
            setSelectedAnatomy([...selectedAnatomy, newAnatomy.id]);
            setAnatomySearch("");
        } catch (err) {
            logError("Error creating anatomy:", err);
            setError("Error creating anatomy");
        } finally {
            setCreatingAnatomy(false);
        }
    };

    // Inline create equipment
    const handleCreateEquipment = async () => {
        if (!user?.company) return;
        setCreatingEquipment(true);

        try {
            const newEquipment = await pb.collection("equipment").create({
                name: capitalize(equipmentSearch.trim()),
                company: user.company,
            });
            setLocalEquipment((prev) => [...prev, newEquipment as any]);
            setSelectedEquipment([...selectedEquipment, newEquipment.id]);
            setEquipmentSearch("");
        } catch (err) {
            logError("Error creating equipment:", err);
            setError("Error creating equipment");
        } finally {
            setCreatingEquipment(false);
        }
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

    // Validate form
    const validateForm = (): boolean => {
        if (!name.trim()) {
            setError("El nombre es requerido");
            return false;
        }
        return true;
    };

    // Handle save
    const handleSave = async () => {
        if (!validateForm() || !user?.company) return;

        setLoading(true);
        try {
            if (exercise) {
                if (imageFile) {
                    const formData = new FormData();
                    formData.append("name", name.trim());
                    formData.append("description", description.trim());
                    formData.append("company", user.company);
                    formData.append("anatomy", JSON.stringify(selectedAnatomy));
                    formData.append("equipment", JSON.stringify(selectedEquipment));
                    formData.append("file", imageFile);
                    await pb.collection("exercises").update(exercise.id, formData);
                } else {
                    await pb.collection("exercises").update(exercise.id, {
                        name: name.trim(),
                        description: description.trim(),
                        company: user.company,
                        anatomy: selectedAnatomy,
                        equipment: selectedEquipment,
                        ...(removeExistingFile ? { file: null as any } : {}),
                    });
                }
            } else {
                if (imageFile) {
                    const formData = new FormData();
                    formData.append("name", name.trim());
                    formData.append("description", description.trim());
                    formData.append("company", user.company);
                    formData.append("anatomy", JSON.stringify(selectedAnatomy));
                    formData.append("equipment", JSON.stringify(selectedEquipment));
                    formData.append("file", imageFile);
                    await pb.collection("exercises").create(formData);
                } else {
                    await pb.collection("exercises").create({
                        name: name.trim(),
                        description: description.trim(),
                        company: user.company,
                        anatomy: selectedAnatomy,
                        equipment: selectedEquipment,
                    });
                }
            }

            setOpen(false);
            resetForm();
            onSuccess();
        } catch (err) {
            logError("Error saving exercise:", err);
            setError("Error al guardar el ejercicio");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!exercise?.id) return;
        setLoading(true);
        try {
            await pb.collection('exercises').delete(exercise.id);
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
                React.isValidElement(trigger) ? React.cloneElement(trigger as any, { onClick: () => onOpenChange(true) }) : trigger
            ) : (
                // Uncontrolled usage: let the trigger open the internal dialog
                trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="text-xl sm:text-2xl">{exercise ? "Editar Ejercicio" : "Crear Ejercicio"}</DialogTitle>
                    <DialogDescription className="text-sm">
                        {exercise
                            ? "Modifica los datos del ejercicio"
                            : "Completa los datos del nuevo ejercicio"}
                    </DialogDescription>
                </DialogHeader>

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
                            ref={(el: HTMLInputElement) => nameInputRef.current = el}
                        />
                    </div>

                    {/* Vídeo */}
                    <div className="space-y-2">
                        <Label>Vídeo</Label>
                        {imagePreview ? (
                            <div className="relative w-40 h-72 bg-slate-100 rounded-lg overflow-hidden">
                                <video
                                    src={imagePreview}
                                    className="w-full h-full object-cover"
                                    controls
                                />
                                <ActionButton
                                    tooltip="Eliminar vídeo"
                                    aria-label="Eliminar vídeo"
                                    onClick={() => {
                                        setImageFile(null);
                                        setImagePreview("");
                                        if (exercise?.file) setRemoveExistingFile(true);
                                    }}
                                    className="absolute top-2 right-2 p-0 bg-[hsl(var(--muted))] transition-none"
                                >
                                    <Trash className="h-4 w-4" />
                                </ActionButton>
                            </div>
                        ) : (
                            <div
                                className={`w-full border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors p-8 text-center group exercise-drag-overlay ${dragOver ? "drag-over" : ""}`}
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
                                        type="file"
                                        accept="video/*"
                                        onChange={handleImageChange}
                                        className="hidden"
                                        disabled={loading}
                                    />
                                    <ImageIcon className="h-8 w-8 mx-auto text-slate-400 mb-2 group-hover:text-slate-500 transition-colors" />
                                    <p className="text-sm text-slate-600 group-hover:text-slate-700 transition-colors">Arrastra y suelta vídeo aquí</p>
                                    <p className="text-xs text-slate-500 mt-1">o haz clic para seleccionar (mp4, mov, webm)</p>
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
                            <Label>Equipamiento</Label>
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
                                            placeholder="Buscar o crear equipamiento..."
                                            value={equipmentSearch}
                                            onChange={(e) => setEquipmentSearch(e.target.value)}
                                            autoFocus={shouldAutoFocus()}
                                        />
                                        <div className="space-y-1 max-h-48 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                            {filteredEquipment.map((e) => (
                                                <label key={e.id} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-sm">
                                                    <Checkbox
                                                        checked={selectedEquipment.includes(e.id)}
                                                        onCheckedChange={(checked) => {
                                                            const isChecked = Boolean(checked)
                                                            if (isChecked) setSelectedEquipment(prev => [...prev, e.id])
                                                            else setSelectedEquipment(prev => prev.filter(id => id !== e.id))
                                                            setEquipmentSearch("")
                                                        }}
                                                    />
                                                    <span className={selectedEquipment.includes(e.id) ? 'font-medium' : ''}>{e.name}</span>

                                                    <button
                                                        onClick={(evt) => { evt.stopPropagation(); handleDeleteEquipment(e.id) }}
                                                        className="ml-auto p-1 rounded hover:bg-red-50 text-red-600"
                                                        title="Eliminar equipamiento"
                                                    >
                                                        <Trash className="h-3 w-3" />
                                                    </button>
                                                </label>
                                            ))}
                                            {showCreateEquipment && (
                                                <button
                                                    onClick={handleCreateEquipment}
                                                    disabled={creatingEquipment}
                                                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 text-sm disabled:opacity-50"
                                                >
                                                    {creatingEquipment ? (
                                                        "Creando..."
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
                                            <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                                {e?.name}
                                                <button
                                                    onClick={() => setSelectedEquipment(selectedEquipment.filter((i) => i !== id))}
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
                            <Label>Anatomía</Label>
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
                                            placeholder="Buscar o crear anatomía..."
                                            value={anatomySearch}
                                            onChange={(e) => setAnatomySearch(e.target.value)}
                                            autoFocus={shouldAutoFocus()}
                                        />
                                        <div className="space-y-1 max-h-48 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                            {filteredAnatomy.map((a) => (
                                                <label key={a.id} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-sm">
                                                    <Checkbox
                                                        checked={selectedAnatomy.includes(a.id)}
                                                        onCheckedChange={(checked) => {
                                                            const isChecked = Boolean(checked)
                                                            if (isChecked) setSelectedAnatomy(prev => [...prev, a.id])
                                                            else setSelectedAnatomy(prev => prev.filter(id => id !== a.id))
                                                            setAnatomySearch("")
                                                        }}
                                                    />
                                                    <span className={selectedAnatomy.includes(a.id) ? 'font-medium' : ''}>{a.name}</span>

                                                    <button
                                                        onClick={(evt) => { evt.stopPropagation(); handleDeleteAnatomy(a.id) }}
                                                        className="ml-auto p-1 rounded hover:bg-red-50 text-red-600"
                                                        title="Eliminar anatomía"
                                                    >
                                                        <Trash className="h-3 w-3" />
                                                    </button>
                                                </label>
                                            ))}
                                            {showCreateAnatomy && (
                                                <button
                                                    onClick={handleCreateAnatomy}
                                                    disabled={creatingAnatomy}
                                                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 text-sm disabled:opacity-50"
                                                >
                                                    {creatingAnatomy ? (
                                                        "Creando..."
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
                                            <Badge key={id} variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                                                {a?.name}
                                                <button
                                                    onClick={() => setSelectedAnatomy(selectedAnatomy.filter((i) => i !== id))}
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

                    {/* Actions */}
                    <div className="flex w-full justify-between pt-4 border-t">
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
                            <Button onClick={handleSave} disabled={loading}>
                                {loading ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar ejercicio?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
