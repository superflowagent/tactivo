import { useState, useEffect } from "react"
import { ArrowUpDown, UserPlus, Pencil, Trash2 } from "lucide-react"
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
import pb from "@/lib/pocketbase"
import { debug, error as logError } from '@/lib/logger'
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

  // Cargar clientes desde PocketBase
  useEffect(() => {
    const fetchClientes = async () => {
      if (!companyId) return

      try {
        setLoading(true)
        setError(null)

        // Filtrar solo clientes de la misma company
        const records = await pb.collection('users').getFullList<Cliente>({
          sort: 'name',
          filter: `company = "${companyId}" && role = "client"`,
        })
        debug('Clientes cargados:', records)
        setClientes(records)
        setFilteredClientes(records)
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
      const query = searchQuery.toLowerCase()
      const filtered = clientes.filter(cliente =>
        (cliente.name && cliente.name.toLowerCase().includes(query)) ||
        (cliente.last_name && cliente.last_name.toLowerCase().includes(query)) ||
        (cliente.dni && cliente.dni.toLowerCase().includes(query)) ||
        (cliente.phone && cliente.phone.toLowerCase().includes(query)) ||
        (cliente.email && cliente.email.toLowerCase().includes(query))
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
    // Recargar los datos más recientes del cliente desde PocketBase
    if (!cliente.id) return

    try {
      const freshCliente = await pb.collection('users').getOne<Cliente>(cliente.id)
      setSelectedCliente(freshCliente)
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
      await pb.collection('users').delete(clienteToDelete)
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

      const records = await pb.collection('users').getFullList<Cliente>({
        sort: 'name',
        filter: `company = "${companyId}" && role = "client"`,
      })
      setClientes(records)
      setFilteredClientes(records)
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
                      src={`https://pocketbase.superflow.es/api/files/users/${cliente.id}/${cliente.photo}`}
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
                      <Trash2 className="h-4 w-4" />
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
