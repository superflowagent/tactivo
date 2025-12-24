import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { error as logError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import ActionButton from "@/components/ui/ActionButton";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ExerciseDialog from "@/components/ejercicios/ExerciseDialog";
import { ExerciseBadgeGroup } from "@/components/ejercicios/ExerciseBadgeGroup";
import { Pencil, Plus, ChevronDown, Trash } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
    } catch (err) {
      logError("Error loading exercises data:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.company]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Delete equipment and anatomy from filters
  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('¿Eliminar equipamiento? Esta acción no se puede deshacer.')) return;
    try {
      await pb.collection('equipment').delete(id);
      setEquipment(prev => prev.filter(x => x.id !== id));
      setSelectedEquipment(prev => prev.filter(i => i !== id));
      // refresh exercises to reflect removal
      await loadData();
    } catch (err) {
      logError('Error deleting equipment:', err);
      alert('Error al eliminar equipamiento');
    }
  };

  const handleDeleteAnatomy = async (id: string) => {
    if (!confirm('¿Eliminar anatomía? Esta acción no se puede deshacer.')) return;
    try {
      await pb.collection('anatomy').delete(id);
      setAnatomy(prev => prev.filter(x => x.id !== id));
      setSelectedAnatomy(prev => prev.filter(i => i !== id));
      await loadData();
    } catch (err) {
      logError('Error deleting anatomy:', err);
      alert('Error al eliminar anatomía');
    }
  };

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



  // Manejar cierre de diálogo
  const handleDialogClose = () => {
    setDialogOpen(false);
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
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mobile: Crear encima del searchbar */}
        <div className="w-full sm:hidden">
          <Button className="w-full mb-2" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-0 h-4 w-4" />
            Crear Ejercicio
          </Button>
        </div>

        {/* Search bar */}
        <Input
          placeholder="Buscar ejercicios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="section-search"
        />

        {/* On mobile: equip + anatomy occupy the same total width as the search */}
        <div className="w-full sm:w-auto flex gap-2">
          <div className="flex-1"><Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-left text-sm">
                <span>Equipamiento</span>
                <div className="flex items-center gap-1">
                  {selectedEquipment.length > 0 && (
                    <span className="font-medium">{selectedEquipment.length}</span>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="popover-content-width" align="start">
              <div className="space-y-1">
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
                        <Checkbox
                          checked={selectedEquipment.includes(eq.id)}
                          onCheckedChange={(checked: boolean | "indeterminate") => {
                            const isChecked = Boolean(checked)
                            if (isChecked) {
                              setSelectedEquipment([...selectedEquipment, eq.id]);
                            } else {
                              setSelectedEquipment(selectedEquipment.filter((id) => id !== eq.id));
                            }
                          }}
                        />
                        <span className="text-sm">{eq.name}</span>
                        <ActionButton tooltip="Eliminar equipamiento" className="ml-auto" onClick={(evt) => { evt.stopPropagation(); evt.preventDefault(); handleDeleteEquipment(eq.id); }}>
                          <Trash className="h-3.5 w-3.5" />
                        </ActionButton>
                      </label>
                    ))} 
                </div>
              </div>
            </PopoverContent>
          </Popover></div>

          <div className="flex-1"><Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-left text-sm">
                <span>Anatomía</span>
                <div className="flex items-center gap-1">
                  {selectedAnatomy.length > 0 && (
                    <span className="font-medium">{selectedAnatomy.length}</span>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="popover-content-width" align="start">
              <div className="space-y-1">
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
                        <Checkbox
                          checked={selectedAnatomy.includes(a.id)}
                          onCheckedChange={(checked: boolean | "indeterminate") => {
                            const isChecked = Boolean(checked)
                            if (isChecked) {
                              setSelectedAnatomy([...selectedAnatomy, a.id]);
                            } else {
                              setSelectedAnatomy(selectedAnatomy.filter((id) => id !== a.id));
                            }
                          }}
                        />
                        <span className="text-sm">{a.name}</span>
                        <ActionButton tooltip="Eliminar anatomía" className="ml-auto" onClick={(evt) => { evt.stopPropagation(); evt.preventDefault(); handleDeleteAnatomy(a.id); }}>
                          <Trash className="h-3.5 w-3.5" />
                        </ActionButton>
                      </label>
                    ))}
                </div>
              </div>
            </PopoverContent>
          </Popover></div>
        </div>

        {(searchTerm || selectedAnatomy.length > 0 || selectedEquipment.length > 0) && (
          <Button variant="outline" onClick={() => { setSearchTerm(""); setSelectedAnatomy([]); setSelectedEquipment([]); }}>Limpiar</Button>
        )}
        <div className="flex-1" />

        {/* Desktop create button remains on the right */}
        <div className="hidden sm:block">
          <ExerciseDialog
            exercise={null}
            anatomy={anatomy}
            equipment={equipment}
            onSuccess={handleDialogClose}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            trigger={
              <Button className="whitespace-nowrap">
                <Plus className="mr-0 h-4 w-4" />
                Crear Ejercicio
              </Button>
            }
          />
        </div>
      </div>

      {/* Filtros aplicados */}
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
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredExercises.map((exercise) => {
              const exerciseAnatomy = anatomy.filter((a) =>
                exercise.anatomy.includes(a.id)
              );
              const exerciseEquipment = equipment.filter((e) =>
                exercise.equipment.includes(e.id)
              );

              return (
                <Card key={exercise.id} className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
                  {/* Card Header: Título, Edit Button y Badges */}
                  <CardHeader className="py-2 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">
                        {exercise.name}
                      </CardTitle>
                      <ExerciseDialog
                        exercise={exercise}
                        anatomy={anatomy}
                        equipment={equipment}
                        onSuccess={handleDialogClose}
                        trigger={
                          <ActionButton tooltip="Editar ejercicio" aria-label="Editar ejercicio">
                            <Pencil className="h-4 w-4" />
                          </ActionButton>
                        }
                      />
                    </div>

                    {/* Badge Area with Overflow Tooltip */}
                    <div className="flex flex-col gap-1">
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

                  {/* Media Container */}
                  <div className="relative bg-slate-200 overflow-hidden aspect-video mt-auto group">
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

                        {/* Eliminado: botón eliminar sobre el vídeo en hover */}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <p className="text-sm text-slate-400">Sin vídeo</p>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}