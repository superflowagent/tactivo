import { useState, useEffect } from "react"
import { ArrowUpDown, UserPlus, Pencil, Trash } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input";
import ActionButton from "@/components/ui/ActionButton";
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
import { ClienteDialog } from "@/components/clientes/ClienteDialog"
import { supabase, getFilePublicUrl } from "@/lib/supabase"
import { error as logError } from '@/lib/logger'
import { normalizeForSearch } from '@/lib/utils'
import type { Cliente } from "@/types/cliente"
import { useAuth } from "@/contexts/AuthContext"

export function ClientesView() {
  const { companyId } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null)

  // Cargar clientes desde `profiles` (Supabase)
  useEffect(() => {
    const fetchClientes = async () => {
      if (!companyId) return

      try {
        setLoading(true)
        setError(null)

        // Filtrar solo clientes de la misma company. Select core fields

        let { data: records, error } = await supabase.from('profiles').select('id, user, name, last_name, dni, phone, photo_path, sport, class_credits, company').eq('company', companyId).eq('role', 'client').order('name')
        if (error) throw error

        // Using Supabase client only (removed REST fallback).

        const mapped = (records || []).map((r: any) => {
          const uid = r.user || r.id
          return ({ id: uid, ...r, photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null })
        })
        setClientes(mapped)
        setFilteredClientes(mapped)
      } catch (err: any) {
        logError('Error al cargar clientes:', err)
        const errorMsg = err?.message || 'Error desconocido'
        setError(`Error al cargar los clientes: ${errorMsg}`)
      } finally {
        setLoading(false)
      }
    }

    fetchClientes()
  }, [companyId])

  // Filtrar clientes cuando cambia la búsqueda
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredClientes(clientes)
    } else {
      const q = normalizeForSearch(searchQuery)
      const filtered = clientes.filter(cliente =>
        (cliente.name && normalizeForSearch(cliente.name).includes(q)) ||
        (cliente.last_name && normalizeForSearch(cliente.last_name).includes(q)) ||
        (cliente.dni && normalizeForSearch(cliente.dni).includes(q)) ||
        (cliente.phone && normalizeForSearch(cliente.phone).includes(q)) ||
        (cliente.email && normalizeForSearch(cliente.email).includes(q))
      )
      setFilteredClientes(filtered)
    }
  }, [searchQuery, clientes])

  const handleSort = () => {
    const sorted = [...filteredClientes].sort((a, b) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name)
      } else {
        return b.name.localeCompare(a.name)
      }
    })
    setFilteredClientes(sorted)
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const handleAdd = () => {
    setSelectedCliente(null)
    setDialogOpen(true)
  }

  const handleEdit = async (cliente: Cliente) => {
    // Recargar los datos más recientes del cliente desde `profiles` (Supabase)
    if (!cliente.id) return

    try {
      const fetcher = await import('@/lib/supabase')
      const freshCliente = await fetcher.fetchProfileByUserId(cliente.id)
      setSelectedCliente(freshCliente || cliente)
    } catch (err) {
      logError('Error al cargar cliente:', err)
      setSelectedCliente(cliente) // Usar datos en cache si falla
    }
    setDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setClienteToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!clienteToDelete) return

    try {
      // Prefer calling delete-user Edge Function so linked auth user is removed (profile cleanup via DB trigger)
      const lib = await import('@/lib/supabase')
      const ok = await lib.ensureValidSession()
      if (!ok) {
        alert('La sesión parece inválida o ha expirado. Por favor cierra sesión e inicia sesión de nuevo.')
        return
      }
      const token = await lib.getAuthToken()

      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // Debug: log function call and token preview
      try {
        const tokenPreview = token ? (String(token).slice(0,8) + '...' + String(token).length) : null
        console.debug('delete-user: calling function', { funcUrl, payload: { user_id: clienteToDelete }, tokenPreview })
      } catch { /* ignore */ }

      const res = await fetch(funcUrl, { method: 'POST', headers, body: JSON.stringify({ user_id: clienteToDelete }) }).catch((e) => { console.warn('delete-user fetch failed', e); return ({ status: 404 }) })

      if (!res || (res as any).status === 404) {
        // Could not reach the function. Fallback: delete profile locally but warn that the auth user was not removed.
        const doFallback = confirm('No se pudo contactar la función de borrado. Esto eliminará solo el perfil, pero no el usuario en Auth. ¿Deseas continuar con la eliminación del perfil?')
        if (!doFallback) return
        const fetcher = await import('@/lib/supabase')
        const del = await fetcher.deleteProfileByUserId(clienteToDelete)
        if (del?.error) throw del.error
      } else {
        const json = await (res as Response).json().catch(() => ({}))
        if (!(res as Response).ok) {
          if ((res as Response).status === 401) {
            const hint = (json?.auth_error && (json.auth_error.message || json.auth_error.error_description || JSON.stringify(json.auth_error))) || json?.error || 'Unauthorized'
            const debug = json?.auth_debug ? '\nDetalles del servidor: ' + JSON.stringify(json.auth_debug) : ''
            alert('No autorizado al intentar eliminar: ' + hint + debug + '\n\nPor favor cierra sesión e inicia sesión de nuevo.')
            return
          }
          throw new Error(json?.error || (res as any).status)
        }
      }

      const updatedClientes = clientes.filter(c => c.id !== clienteToDelete)
      setClientes(updatedClientes)
      setFilteredClientes(updatedClientes)
      setDeleteDialogOpen(false)
      setClienteToDelete(null)
    } catch (err: any) {
      logError('Error al eliminar cliente:', err)
      alert('Error al eliminar el cliente: ' + (err?.message || 'Error desconocido'))
    }
  }

  const handleSave = async () => {
    // Recargar la lista de clientes
    try {
      if (!companyId) return

      const cid = companyId
      const { data: records, error } = await supabase.from('profiles').select('id, user, name, last_name, dni, phone, photo_path, sport, class_credits, company').eq('company', cid).eq('role', 'client').order('name')
      if (error) throw error
      setClientes((records || []).map((r: any) => ({ id: r.user || r.id, ...r })))
      setFilteredClientes((records || []).map((r: any) => ({ id: r.user || r.id, ...r })))
    } catch (err) {
      logError('Error al recargar clientes:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Cargando clientes...</p>
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
          placeholder="Buscar clientes..."
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
          <UserPlus className="mr-0 h-4 w-4" />
          Crear Cliente
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
              <TableHead>Deporte</TableHead>
              <TableHead>Clases Restantes</TableHead>
              <TableHead className="text-right pr-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClientes.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell>
                  {cliente.photo ? (
                    <img
                      src={getFilePublicUrl('profile_photos', cliente.id, cliente.photo) || undefined}
                      alt={cliente.name}
                      className="w-10 h-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-sm font-medium">
                      {cliente.name.charAt(0)}{cliente.last_name.charAt(0)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{cliente.name} {cliente.last_name}</TableCell>
                <TableCell>{cliente.dni}</TableCell>
                <TableCell>{cliente.phone}</TableCell>
                <TableCell>{cliente.email}</TableCell>
                <TableCell>{cliente.sport || '-'}</TableCell>
                <TableCell>{cliente.class_credits || 0}</TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-0.5">
                    <ActionButton tooltip="Editar" onClick={() => handleEdit(cliente)} aria-label="Editar cliente">
                      <Pencil className="h-4 w-4" />
                    </ActionButton>
                    <ActionButton tooltip="Eliminar" onClick={() => {
                      if (!cliente.id) return; handleDeleteClick(cliente.id);
                    }} aria-label="Eliminar cliente">
                      <Trash className="h-4 w-4" />
                    </ActionButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={selectedCliente}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
