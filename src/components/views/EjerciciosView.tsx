import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ExerciseDialog from "@/components/ejercicios/ExerciseDialog";
import { ExerciseBadgeGroup } from "@/components/ejercicios/ExerciseBadgeGroup";
import { Pencil, Trash2, Plus } from "lucide-react";

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

interface EquipmentRecord {
  id: string;
  name: string;
}

interface AnatomyRecord {
  id: string;
  name: string;
}

export function EjerciciosView() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [anatomy, setAnatomy] = useState<AnatomyRecord[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAnatomy, setSelectedAnatomy] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [anatomyFilterQuery, setAnatomyFilterQuery] = useState("");
  const [equipmentFilterQuery, setEquipmentFilterQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Cargar ejercicios, anatomías y equipamiento
  const loadData = useCallback(async () => {
    if (!user?.company) return;

    try {
      setLoading(true);

      // Cargar ejercicios
      const exercisesResult = await pb.collection("exercises").getFullList({
        filter: `company = "${user.company}"`,
      });
      setExercises(exercisesResult as unknown as Exercise[]);

      // Cargar anatomías
      const anatomyResult = await pb.collection("anatomy").getFullList({
        filter: `company = "${user.company}"`,
      });
      setAnatomy(anatomyResult as unknown as AnatomyRecord[]);

      // Cargar equipamiento
      const equipmentResult = await pb.collection("equipment").getFullList({
        filter: `company = "${user.company}"`,
      });
      setEquipment(equipmentResult as unknown as EquipmentRecord[]);
    } catch (error) {
      console.error("Error loading exercises data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.company]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isVideo = (file?: string) => {
    if (!file) return false;
    const lower = file.toLowerCase();
    return lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm");
  };

  // Filtrar ejercicios basado en búsqueda y filtros seleccionados
  const filteredExercises = exercises.filter((exercise) => {
    // Filtro de búsqueda
    const matchesSearch =
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.description.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filtro de anatomía (OR logic - si hay seleccionadas)
    if (selectedAnatomy.length > 0) {
      const hasSelectedAnatomy = selectedAnatomy.some((id) =>
        exercise.anatomy.includes(id)
      );
      if (!hasSelectedAnatomy) return false;
    }

    // Filtro de equipamiento (OR logic - si hay seleccionadas)
    if (selectedEquipment.length > 0) {
      const hasSelectedEquipment = selectedEquipment.some((id) =>
        exercise.equipment.includes(id)
      );
      if (!hasSelectedEquipment) return false;
    }

    return true;
  });

  // Manejar eliminación
  const handleDelete = async (exerciseId: string) => {
    try {
      await pb.collection("exercises").delete(exerciseId);
      setExercises(exercises.filter((e) => e.id !== exerciseId));
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  };

  // Manejar cierre de diálogo
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingExercise(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Ejercicios</h1>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="w-full aspect-[9/16]" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold">Ejercicios</h1>
        <ExerciseDialog
          exercise={null}
          anatomy={anatomy}
          equipment={equipment}
          onSuccess={handleDialogClose}
          trigger={
            <Button size="sm" className="whitespace-nowrap">
              <Plus className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Crear Ejercicio</span>
              <span className="sm:hidden">Crear</span>
            </Button>
          }
        />
      </div>

      {/* Filtros y búsqueda */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Buscar ejercicios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-sm"
          />
          {/* Equipamiento dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left min-w-40 sm:min-w-56 text-sm">
                {selectedEquipment.length > 0 ? `${selectedEquipment.length} eq.` : "Equipamiento"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-3">
                <Input
                  placeholder="Buscar equipamiento..."
                  value={equipmentFilterQuery}
                  onChange={(e) => setEquipmentFilterQuery(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto space-y-1" onWheel={(e) => e.stopPropagation()}>
                  {equipment
                    .filter((eq) => eq.name.toLowerCase().includes(equipmentFilterQuery.toLowerCase()))
                    .map((eq) => (
                      <label key={eq.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedEquipment.includes(eq.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEquipment([...selectedEquipment, eq.id]);
                            } else {
                              setSelectedEquipment(selectedEquipment.filter((id) => id !== eq.id));
                            }
                          }}
                        />
                        <span className="text-sm">{eq.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Anatomía dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left min-w-40 sm:min-w-56 text-sm">
                {selectedAnatomy.length > 0 ? `${selectedAnatomy.length} anat.` : "Anatomía"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-3">
                <Input
                  placeholder="Buscar anatomía..."
                  value={anatomyFilterQuery}
                  onChange={(e) => setAnatomyFilterQuery(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto space-y-1" onWheel={(e) => e.stopPropagation()}>
                  {anatomy
                    .filter((a) => a.name.toLowerCase().includes(anatomyFilterQuery.toLowerCase()))
                    .map((a) => (
                      <label key={a.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedAnatomy.includes(a.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAnatomy([...selectedAnatomy, a.id]);
                            } else {
                              setSelectedAnatomy(selectedAnatomy.filter((id) => id !== a.id));
                            }
                          }}
                        />
                        <span className="text-sm">{a.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {(searchTerm || selectedAnatomy.length > 0 || selectedEquipment.length > 0) && (
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setSelectedAnatomy([]); setSelectedEquipment([]); }}>Limpiar</Button>
          )}
        </div>

        {(selectedAnatomy.length > 0 || selectedEquipment.length > 0) && (
          <div className="flex gap-2 flex-wrap">
            {selectedEquipment.map((id) => {
              const e = equipment.find((x) => x.id === id);
              return (
                <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                  {e?.name}
                  <button className="ml-1" onClick={() => setSelectedEquipment(selectedEquipment.filter((i) => i !== id))}>×</button>
                </Badge>
              );
            })}
            {selectedAnatomy.map((id) => {
              const a = anatomy.find((x) => x.id === id);
              return (
                <Badge key={id} variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                  {a?.name}
                  <button className="ml-1" onClick={() => setSelectedAnatomy(selectedAnatomy.filter((i) => i !== id))}>×</button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Resultados */}
      <div>
        <p className="text-sm text-slate-600 mb-4">
          {filteredExercises.length} ejercicio{filteredExercises.length !== 1 ? "s" : ""} encontrado{filteredExercises.length !== 1 ? "s" : ""}
        </p>

        {filteredExercises.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">No hay ejercicios que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredExercises.map((exercise) => {
              const exerciseAnatomy = anatomy.filter((a) =>
                exercise.anatomy.includes(a.id)
              );
              const exerciseEquipment = equipment.filter((e) =>
                exercise.equipment.includes(e.id)
              );

              return (
                <Card key={exercise.id} className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
                  {/* Media Container with Action Buttons */}
                  <div className="relative bg-slate-200 overflow-hidden aspect-[9/16] group">
                    {exercise.file ? (
                      <>
                        {isVideo(exercise.file) ? (
                          <video
                            src={pb.files.getUrl(exercise, exercise.file)}
                            className="w-full h-full object-cover"
                            controls
                          />
                        ) : (
                          <img
                            src={pb.files.getUrl(exercise, exercise.file)}
                            alt={exercise.name}
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Action Buttons on Hover */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <ExerciseDialog
                            exercise={exercise}
                            anatomy={anatomy}
                            equipment={equipment}
                            onSuccess={handleDialogClose}
                            trigger={
                              <button className="p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-colors">
                                <Pencil className="h-4 w-4 text-slate-700" />
                              </button>
                            }
                          />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="p-2 rounded-full bg-white/90 hover:bg-red-50 shadow-md transition-colors">
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogTitle>¿Eliminar ejercicio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará "{exercise.name}" de forma permanente.
                              </AlertDialogDescription>
                              <div className="flex gap-2 justify-end">
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(exercise.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <p className="text-sm text-slate-400">Sin vídeo</p>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold line-clamp-2">
                      {exercise.name}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col space-y-2">
                    {exercise.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {exercise.description}
                      </p>
                    )}

                    {/* Fixed Badge Area with Overflow Tooltip */}
                    <div className="flex-1 flex flex-col gap-2 min-h-16 justify-end">
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}