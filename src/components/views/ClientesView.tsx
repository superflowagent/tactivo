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
        const sessionRes = await supabase.auth.getSession()

        let { data: records, error } = await supabase.from('profiles').select('id, user, name, last_name, dni, phone, photo_path, sport, class_credits, company').eq('company', companyId).eq('role', 'client').order('name')
        if (error) throw error

        // Fallback: if we got no rows, try a direct REST request with current access token to rule out header/session race
        if ((!records || (Array.isArray(records) && records.length === 0))) {
          try {
            const token = sessionRes.data?.session?.access_token
            if (token) {
              const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id,user,name,last_name,dni,phone,photo_path,sport,class_credits,company&company=eq.${companyId}&role=eq.client&order=name.asc`
              const resp = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token } })
              if (resp.ok) {
                const json = await resp.json()
                records = json
              }
            }
          } catch {
            // fallback REST request failed — ignore and continue (we will surface error later if needed)
          }
        }

        const mapped = (records || []).map((r: any) => ({ id: r.user || r.id, ...r }))
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
      const fetcher = await import('@/lib/supabase')
      const res = await fetcher.deleteProfileByUserId(clienteToDelete)
      if (res?.error) throw res.error
      try {
        const { deleteUserCardForUser } = await import('@/lib/userCards')
        await deleteUserCardForUser(clienteToDelete)
      } catch (e) {
        logError('Error deleting associated user_card:', e)
      }
      const updatedClientes = clientes.filter(c => c.id !== clienteToDelete)
      setClientes(updatedClientes)
      setFilteredClientes(updatedClientes)
      setDeleteDialogOpen(false)
      setClienteToDelete(null)
    } catch (err) {
      logError('Error al eliminar cliente:', err)
      alert('Error al eliminar el cliente')
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
                      src={getFilePublicUrl('users', cliente.id, cliente.photo) || undefined}
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
