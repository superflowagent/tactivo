import { useState } from "react"
import { ArrowUpDown, Plus, Pencil, Trash2 } from "lucide-react"
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

interface Cliente {
  id: string
  nombre: string
  telefono: string
  email: string
}

const clientesData: Cliente[] = [
  {
    id: "1",
    nombre: "María García López",
    telefono: "+34 612 345 678",
    email: "maria.garcia@email.com",
  },
  {
    id: "2",
    nombre: "Juan Martínez Sánchez",
    telefono: "+34 623 456 789",
    email: "juan.martinez@email.com",
  },
  {
    id: "3",
    nombre: "Ana Rodríguez Pérez",
    telefono: "+34 634 567 890",
    email: "ana.rodriguez@email.com",
  },
  {
    id: "4",
    nombre: "Carlos Fernández Torres",
    telefono: "+34 645 678 901",
    email: "carlos.fernandez@email.com",
  },
  {
    id: "5",
    nombre: "Laura González Díaz",
    telefono: "+34 656 789 012",
    email: "laura.gonzalez@email.com",
  },
]

export function ClientesView() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesData)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const handleSort = () => {
    const sorted = [...clientes].sort((a, b) => {
      if (sortOrder === "asc") {
        return a.nombre.localeCompare(b.nombre)
      } else {
        return b.nombre.localeCompare(a.nombre)
      }
    })
    setClientes(sorted)
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const handleAdd = () => {
    // TODO: Implementar lógica para agregar cliente
    console.log("Agregar cliente")
  }

  const handleEdit = (id: string) => {
    // TODO: Implementar lógica para editar cliente
    console.log("Editar cliente:", id)
  }

  const handleDelete = (id: string) => {
    // TODO: Implementar lógica para eliminar cliente
    console.log("Eliminar cliente:", id)
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar clientes..."
          className="max-w-sm"
        />
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Cliente
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell className="font-medium">{cliente.nombre}</TableCell>
                <TableCell>{cliente.telefono}</TableCell>
                <TableCell>{cliente.email}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(cliente.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cliente.id)}
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
    </div>
  )
}
