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

interface Profesional {
  id: string
  nombre: string
  telefono: string
  email: string
}

const profesionalesData: Profesional[] = [
  {
    id: "1",
    nombre: "Dr. Pedro Sánchez Ruiz",
    telefono: "+34 611 234 567",
    email: "pedro.sanchez@clinica.com",
  },
  {
    id: "2",
    nombre: "Dra. Carmen López Martín",
    telefono: "+34 622 345 678",
    email: "carmen.lopez@clinica.com",
  },
  {
    id: "3",
    nombre: "Dr. Miguel Torres García",
    telefono: "+34 633 456 789",
    email: "miguel.torres@clinica.com",
  },
]

export function ProfesionalesView() {
  const [profesionales, setProfesionales] = useState<Profesional[]>(profesionalesData)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const handleSort = () => {
    const sorted = [...profesionales].sort((a, b) => {
      if (sortOrder === "asc") {
        return a.nombre.localeCompare(b.nombre)
      } else {
        return b.nombre.localeCompare(a.nombre)
      }
    })
    setProfesionales(sorted)
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const handleAdd = () => {
    // TODO: Implementar lógica para agregar profesional
    console.log("Agregar profesional")
  }

  const handleEdit = (id: string) => {
    // TODO: Implementar lógica para editar profesional
    console.log("Editar profesional:", id)
  }

  const handleDelete = (id: string) => {
    // TODO: Implementar lógica para eliminar profesional
    console.log("Eliminar profesional:", id)
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar profesionales..."
          className="max-w-sm"
        />
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Profesional
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
            {profesionales.map((profesional) => (
              <TableRow key={profesional.id}>
                <TableCell className="font-medium">{profesional.nombre}</TableCell>
                <TableCell>{profesional.telefono}</TableCell>
                <TableCell>{profesional.email}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(profesional.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(profesional.id)}
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
