import { useState, useEffect, useMemo } from "react";
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
import { AlertCircle, Plus, X, Image as ImageIcon, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    trigger: React.ReactNode;
}

export default function ExerciseDialog({
    exercise,
    anatomy,
    equipment,
    onSuccess,
    trigger,
}: ExerciseDialogProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedAnatomy, setSelectedAnatomy] = useState<string[]>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [removeExistingFile, setRemoveExistingFile] = useState(false);

    // Inline creation state
    const [anatomySearch, setAnatomySearch] = useState("");
    const [equipmentSearch, setEquipmentSearch] = useState("");
    const [creatingAnatomy, setCreatingAnatomy] = useState(false);
    const [creatingEquipment, setCreatingEquipment] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    // Filter anatomy and equipment based on search
    const filteredAnatomy = useMemo(() => {
        if (!anatomySearch) return anatomy;
        return anatomy.filter((a) =>
            a.name.toLowerCase().includes(anatomySearch.toLowerCase())
        );
    }, [anatomy, anatomySearch]);

    const filteredEquipment = useMemo(() => {
        if (!equipmentSearch) return equipment;
        return equipment.filter((e) =>
            e.name.toLowerCase().includes(equipmentSearch.toLowerCase())
        );
    }, [equipment, equipmentSearch]);

    // Check if anatomy/equipment creation option should show
    const showCreateAnatomy =
        anatomySearch &&
        !anatomy.some(
            (a) => a.name.toLowerCase() === anatomySearch.toLowerCase()
        ) &&
        !creatingAnatomy;

    const showCreateEquipment =
        equipmentSearch &&
        !equipment.some(
            (e) => e.name.toLowerCase() === equipmentSearch.toLowerCase()
        ) &&
        !creatingEquipment;

    // Initialize form with exercise data
    useEffect(() => {
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
    }, [exercise, open]);

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
    const handleCreateAnatomy = async () => {
        if (!user?.company) return;
        setCreatingAnatomy(true);

        try {
            const newAnatomy = await pb.collection("anatomy").create({
                name: anatomySearch.trim(),
                company: user.company,
            });
            setSelectedAnatomy([...selectedAnatomy, newAnatomy.id]);
            setAnatomySearch("");
        } catch (err) {
            console.error("Error creating anatomy:", err);
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
                name: equipmentSearch.trim(),
                company: user.company,
            });
            setSelectedEquipment([...selectedEquipment, newEquipment.id]);
            setEquipmentSearch("");
        } catch (err) {
            console.error("Error creating equipment:", err);
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
            console.error("Error saving exercise:", err);
            setError("Error al guardar el ejercicio");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
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
                        <Alert variant="destructive">
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
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageFile(null);
                                        setImagePreview("");
                                        if (exercise?.file) setRemoveExistingFile(true);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-md"
                                >
                                    <X className="h-4 w-4" />
                                </button>
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
                                <PopoverContent className="w-80" align="start">
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Buscar o crear equipamiento..."
                                            value={equipmentSearch}
                                            onChange={(e) => setEquipmentSearch(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="space-y-2 max-h-48 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                            {filteredEquipment.map((e) => (
                                                <button
                                                    key={e.id}
                                                    onClick={() => {
                                                        if (!selectedEquipment.includes(e.id)) {
                                                            setSelectedEquipment([...selectedEquipment, e.id]);
                                                        }
                                                        setEquipmentSearch("");
                                                    }}
                                                    disabled={selectedEquipment.includes(e.id)}
                                                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                >
                                                    {e.name}
                                                </button>
                                            ))}
                                            {showCreateEquipment && (
                                                <button
                                                    onClick={handleCreateEquipment}
                                                    disabled={creatingEquipment}
                                                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm disabled:opacity-50"
                                                >
                                                    {creatingEquipment ? (
                                                        "Creando..."
                                                    ) : (
                                                        <>
                                                            <Plus className="h-3 w-3 inline mr-1" />
                                                            Crear '{equipmentSearch}'
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
                                        const e = equipment.find((x) => x.id === id);
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
                                <PopoverContent className="w-80" align="start">
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Buscar o crear anatomía..."
                                            value={anatomySearch}
                                            onChange={(e) => setAnatomySearch(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="space-y-2 max-h-48 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                            {filteredAnatomy.map((a) => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => {
                                                        if (!selectedAnatomy.includes(a.id)) {
                                                            setSelectedAnatomy([...selectedAnatomy, a.id]);
                                                        }
                                                        setAnatomySearch("");
                                                    }}
                                                    disabled={selectedAnatomy.includes(a.id)}
                                                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                >
                                                    {a.name}
                                                </button>
                                            ))}
                                            {showCreateAnatomy && (
                                                <button
                                                    onClick={handleCreateAnatomy}
                                                    disabled={creatingAnatomy}
                                                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm disabled:opacity-50"
                                                >
                                                    {creatingAnatomy ? (
                                                        "Creando..."
                                                    ) : (
                                                        <>
                                                            <Plus className="h-3 w-3 inline mr-1" />
                                                            Crear '{anatomySearch}'
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
                                        const a = anatomy.find((x) => x.id === id);
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
                    <div className="flex gap-2 justify-end pt-4 border-t">
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
            </DialogContent>
        </Dialog>
    );
}
