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
import { supabase } from "@/lib/supabase"
import { error as logError } from "@/lib/logger";
import { normalizeForSearch } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext"
import { ProfesionalDialog } from "@/components/profesionales/ProfesionalDialog"
import useResolvedFileUrl from '@/hooks/useResolvedFileUrl'

interface Profesional {
  id: string
  name: string
  last_name: string
  dni: string
  phone: string
  email: string
  photo?: string
  photo_path?: string | null
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

  const handleDeleteClick = (id: string) => {
    setProfesionalToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!profesionalToDelete) return
    try {
      const api = await import('@/lib/supabase')
      const del = await api.deleteProfileByUserId(profesionalToDelete)
      if (del?.error) throw del.error

      // remove from UI
      const updated = profesionales.filter(p => p.id !== profesionalToDelete)
      setProfesionales(updated)
      setFilteredProfesionales(updated)
      setDeleteDialogOpen(false)
      setProfesionalToDelete(null)
    } catch (err) {
      logError('Error al eliminar profesional:', err)
      alert('Error al eliminar el profesional')
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProfesional, setSelectedProfesional] = useState<Profesional | null>(null)

  // Cargar profesionales desde `profiles` (Supabase)
  useEffect(() => {
    const fetchProfesionales = async () => {
      if (!companyId) return

      try {
        setLoading(true)
        setError(null)

        const cid = companyId

        // Filtrar solo profesionales de la misma company. Select core fields
        const { data: records, error } = await supabase.from('profiles').select('id, user, name, last_name, dni, phone, photo_path, role, company').eq('company', cid).eq('role', 'professional').order('name')
        if (error) throw error
        const mapped = (records || []).map((r: any) => {
          const uid = r.user || r.id
          return ({ id: uid, ...r })
        })
        setProfesionales(mapped)
        setFilteredProfesionales(mapped)
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
      const q = normalizeForSearch(searchQuery)
      const filtered = profesionales.filter(profesional =>
        (profesional.name && normalizeForSearch(profesional.name).includes(q)) ||
        (profesional.last_name && normalizeForSearch(profesional.last_name).includes(q)) ||
        (profesional.dni && normalizeForSearch(profesional.dni).includes(q)) ||
        (profesional.phone && normalizeForSearch(profesional.phone).includes(q)) ||
        (profesional.email && normalizeForSearch(profesional.email).includes(q))
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
    // Recargar los datos más recientes del profesional desde `profiles` (Supabase)
    if (!profesional.id) return

    try {
      const fetcher = await import('@/lib/supabase')
      const freshProfesional = await fetcher.fetchProfileByUserId(profesional.id)
      setSelectedProfesional(freshProfesional || profesional)
    } catch (err) {
      logError('Error al cargar profesional:', err)
      setSelectedProfesional(profesional) // Usar datos en cache si falla
    }
    setDialogOpen(true)
  }



  // keep backward-compatible delete handler (used in confirmation dialog)
  // It delegates to the new handleDeleteConfirm implementation above


  const handleSave = async () => {
    // Recargar la lista de profesionales
    try {
      if (!companyId) return

      const { data: records, error } = await supabase.from('profiles').select('id, user, name, last_name, dni, phone, photo_path, role, company').eq('company', companyId).eq('role', 'professional').order('name')
      if (error) throw error
      const mapped = (records || []).map((r: any) => ({ id: r.user || r.id, ...r }))
      setProfesionales(mapped)
      setFilteredProfesionales(mapped)
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

  function ProfileAvatar({ id, photoPath, name, lastName }: { id: string, photoPath?: string | null, name: string, lastName: string }) {
    const url = useResolvedFileUrl('users', id, photoPath || null)
    if (url) {
      return <img src={url} alt={name} className="w-10 h-10 rounded-md object-cover" />
    }
    return (
      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-sm font-medium">
        {name.charAt(0)}{lastName.charAt(0)}
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
                  <ProfileAvatar id={profesional.id} photoPath={profesional.photo_path} name={profesional.name} lastName={profesional.last_name} />
                </TableCell>
                <TableCell className="font-medium">{profesional.name} {profesional.last_name}</TableCell>
                <TableCell>{profesional.dni}</TableCell>
                <TableCell>{profesional.phone}</TableCell>
                <TableCell>{profesional.email}</TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-0.5">
                    <ActionButton tooltip="Editar" onClick={() => handleEdit(profesional)} aria-label="Editar profesional">
                      <Pencil className="h-4 w-4" />
                    </ActionButton>
                    <ActionButton tooltip="Eliminar" onClick={() => { setProfesionalToDelete(profesional.id); setDeleteDialogOpen(true) }} aria-label="Eliminar profesional">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11v6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 11v6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 6V4h6v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </ActionButton>
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
