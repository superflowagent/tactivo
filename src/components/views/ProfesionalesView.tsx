import { useState, useEffect } from "react"
import { ArrowUpDown, UserStar, Pencil } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button";
import ActionButton from "@/components/ui/ActionButton";
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import pb from "@/lib/pocketbase"
import { debug, error as logError } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext"
import { ProfesionalDialog } from "@/components/profesionales/ProfesionalDialog"

interface Profesional {
  id: string
  name: string
  last_name: string
  dni: string
  phone: string
  email: string
  photo?: string
  company: string
}

export function ProfesionalesView() {
  const { companyId, user } = useAuth()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [filteredProfesionales, setFilteredProfesionales] = useState<Profesional[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [profesionalToDelete, setProfesionalToDelete] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProfesional, setSelectedProfesional] = useState<Profesional | null>(null)

  // Cargar profesionales desde PocketBase
  useEffect(() => {
    const fetchProfesionales = async () => {
      if (!companyId) return

      try {
        setLoading(true)
        setError(null)

        // Filtrar solo profesionales de la misma company
        const records = await pb.collection('users').getFullList<Profesional>({
          sort: 'name',
          filter: `company = "${companyId}" && role = "professional"`,
        })
        debug('Profesionales cargados:', records)
        setProfesionales(records)
        setFilteredProfesionales(records)
      } catch (err: any) {
        logError('Error al cargar profesionales:', err)
        const errorMsg = err?.message || 'Error desconocido'
        setError(`Error al cargar los profesionales: ${errorMsg}`)
      } finally {
        setLoading(false)
      }
    }

    fetchProfesionales()
  }, [companyId])

  // Filtrar profesionales cuando cambia la búsqueda
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProfesionales(profesionales)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = profesionales.filter(profesional =>
        (profesional.name && profesional.name.toLowerCase().includes(query)) ||
        (profesional.last_name && profesional.last_name.toLowerCase().includes(query)) ||
        (profesional.dni && profesional.dni.toLowerCase().includes(query)) ||
        (profesional.phone && profesional.phone.toLowerCase().includes(query)) ||
        (profesional.email && profesional.email.toLowerCase().includes(query))
      )
      setFilteredProfesionales(filtered)
    }
  }, [searchQuery, profesionales])

  const handleSort = () => {
    const sorted = [...filteredProfesionales].sort((a, b) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name)
      } else {
        return b.name.localeCompare(a.name)
      }
    })
    setFilteredProfesionales(sorted)
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const handleAdd = () => {
    setSelectedProfesional(null)
    setDialogOpen(true)
  }

  const handleEdit = async (profesional: Profesional) => {
    // Recargar los datos más recientes del profesional desde PocketBase
    if (!profesional.id) return

    try {
      const freshProfesional = await pb.collection('users').getOne<Profesional>(profesional.id)
      setSelectedProfesional(freshProfesional)
    } catch (err) {
      logError('Error al cargar profesional:', err)
      setSelectedProfesional(profesional) // Usar datos en cache si falla
    }
    setDialogOpen(true)
  }



  const handleDeleteConfirm = async () => {
    if (!profesionalToDelete) return

    try {
      await pb.collection('users').delete(profesionalToDelete)
      const updatedProfesionales = profesionales.filter(p => p.id !== profesionalToDelete)
      setProfesionales(updatedProfesionales)
      setFilteredProfesionales(updatedProfesionales)
      setDeleteDialogOpen(false)
      setProfesionalToDelete(null)
    } catch (err) {
      logError('Error al eliminar profesional:', err)
      alert('Error al eliminar el profesional')
    }
  }

  const handleSave = async () => {
    // Recargar la lista de profesionales
    try {
      if (!companyId) return

      const records = await pb.collection('users').getFullList<Profesional>({
        sort: 'name',
        filter: `company = "${companyId}" && role = "professional"`,
      })
      setProfesionales(records)
      setFilteredProfesionales(records)
    } catch (err) {
      logError('Error al recargar profesionales:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Cargando profesionales...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar profesionales..."
          className="section-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button variant="outline" onClick={() => setSearchQuery('')}>
            Limpiar filtros
          </Button>
        )}
        <div className="flex-1" />
        <Button onClick={handleAdd}>
          <UserStar className="mr-0 h-4 w-4" />
          Crear Profesional
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={handleSort}
                  className="flex items-center gap-2 p-0 hover:bg-transparent"
                >
                  Nombre
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right pr-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProfesionales.map((profesional) => (
              <TableRow key={profesional.id}>
                <TableCell>
                  {profesional.photo ? (
                    <img
                      src={`https://pocketbase.superflow.es/api/files/users/${profesional.id}/${profesional.photo}`}
                      alt={profesional.name}
                      className="w-10 h-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-sm font-medium">
                      {profesional.name.charAt(0)}{profesional.last_name.charAt(0)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{profesional.name} {profesional.last_name}</TableCell>
                <TableCell>{profesional.dni}</TableCell>
                <TableCell>{profesional.phone}</TableCell>
                <TableCell>{profesional.email}</TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-0.5">
                    {/* Solo puede editar su propio perfil */}
                    {profesional.id === user?.id && (
                      <ActionButton tooltip="Editar" onClick={() => handleEdit(profesional)} aria-label="Editar profesional">
                        <Pencil className="h-4 w-4" />
                      </ActionButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProfesionalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profesional={selectedProfesional}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar profesional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El profesional será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
