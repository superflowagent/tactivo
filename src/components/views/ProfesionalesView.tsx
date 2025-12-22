import { useState, useEffect } from "react"
import { ArrowUpDown, UserStar, Pencil, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
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
import { useAuth } from "@/contexts/AuthContext"

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
  const { companyId } = useAuth()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [filteredProfesionales, setFilteredProfesionales] = useState<Profesional[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [profesionalToDelete, setProfesionalToDelete] = useState<string | null>(null)

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
        console.log('Profesionales cargados:', records)
        setProfesionales(records)
        setFilteredProfesionales(records)
      } catch (err: any) {
        console.error('Error al cargar profesionales:', err)
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
    // TODO: Implementar lógica para agregar profesional
    console.log("Agregar profesional")
  }

  const handleEdit = (profesional: Profesional) => {
    // TODO: Implementar lógica para editar profesional
    console.log("Editar profesional:", profesional.id)
  }

  const handleDeleteClick = (id: string) => {
    setProfesionalToDelete(id)
    setDeleteDialogOpen(true)
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
      console.error('Error al eliminar profesional:', err)
      alert('Error al eliminar el profesional')
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
          className="max-w-sm"
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

      <div className="rounded-xl border bg-card">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(profesional)}
                      className="hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(profesional.id)}
                      className="hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
