import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { CalendarIcon, ChevronDown, UserPlus, PencilLine } from "lucide-react"
import { cn } from "@/lib/utils"
import pb from "@/lib/pocketbase"
import type { Cliente } from "@/types/cliente"
import { useAuth } from "@/contexts/AuthContext"

interface ClienteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    cliente?: Cliente | null
    onSave: () => void
}

export function ClienteDialog({ open, onOpenChange, cliente, onSave }: ClienteDialogProps) {
    const { companyId } = useAuth()
    const [formData, setFormData] = useState<Cliente>({
        name: "",
        last_name: "",
        dni: "",
        email: "",
        phone: "",
        company: "",
        session_credits: 0,
        class_credits: 0,
    })
    const [fechaNacimiento, setFechaNacimiento] = useState<Date | undefined>(undefined)
    const [edad, setEdad] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [phoneError, setPhoneError] = useState<string>("")

    useEffect(() => {
        if (cliente) {
            setFormData(cliente)
            if (cliente.birth_date) {
                const date = new Date(cliente.birth_date)
                setFechaNacimiento(date)
                calcularEdad(date)
            }
            // Cargar preview de foto existente
            if (cliente.photo) {
                setPhotoPreview(pb.files.getURL(cliente, cliente.photo))
            } else {
                setPhotoPreview(null)
            }
        } else {
            setFormData({
                name: "",
                last_name: "",
                dni: "",
                email: "",
                phone: "",
                company: "",
                session_credits: 0,
                class_credits: 0,
            })
            setFechaNacimiento(undefined)
            setEdad(null)
            setPhotoFile(null)
            setPhotoPreview(null)
        }
        setPhoneError("")
    }, [cliente, open])

    const calcularEdad = (fecha: Date) => {
        const hoy = new Date()
        let edad = hoy.getFullYear() - fecha.getFullYear()
        const mes = hoy.getMonth() - fecha.getMonth()
        if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
            edad--
        }
        setEdad(edad)
    }

    const handleDateSelect = (date: Date | undefined) => {
        setFechaNacimiento(date)
        if (date) {
            calcularEdad(date)
        } else {
            setEdad(null)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validar teléfono
        if (formData.phone && !/^\d{9}$/.test(formData.phone)) {
            setPhoneError("El teléfono debe tener exactamente 9 dígitos")
            return
        }

        setLoading(true)

        try {
            const formDataToSend = new FormData()

            // Añadir campos regulares (excluyendo campos especiales y metadata)
            Object.entries(formData).forEach(([key, value]) => {
                // Excluir campos que se manejan por separado o son metadata
                if (key === 'id' || key === 'created' || key === 'updated' || key === 'photo' || key === 'birth_date' || key === 'email') {
                    return
                }
                // Solo añadir si tiene valor
                if (value !== undefined && value !== null && value !== '') {
                    formDataToSend.append(key, String(value))
                }
            })

            // Añadir email solo si es creación o si ha cambiado
            if (!cliente?.id) {
                // Creación: siempre añadir email
                if (formData.email) {
                    formDataToSend.append('email', formData.email)
                    formDataToSend.append('emailVisibility', 'true')
                }
            } else if (formData.email && formData.email !== cliente.email) {
                // Actualización: solo si el email ha cambiado
                formDataToSend.append('email', formData.email)
                formDataToSend.append('emailVisibility', 'true')
            }

            // Añadir foto si hay una nueva
            if (photoFile) {
                formDataToSend.append('photo', photoFile)
            }

            // Añadir fecha de nacimiento
            if (fechaNacimiento) {
                formDataToSend.append('birth_date', format(fechaNacimiento, "yyyy-MM-dd"))
            }

            // Añadir role si es nuevo cliente
            if (!cliente?.id) {
                formDataToSend.append('role', 'client')
                // Auto-asignar company del profesional logueado
                if (companyId) {
                    formDataToSend.append('company', companyId)
                }
                // Generar contraseña automática para nuevos clientes (requerido por PocketBase)
                const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10)
                formDataToSend.append('password', randomPassword)
                formDataToSend.append('passwordConfirm', randomPassword)
            }

            if (cliente?.id) {
                // Actualizar cliente existente
                await pb.collection('users').update(cliente.id, formDataToSend)
            } else {
                // Crear nuevo cliente
                await pb.collection('users').create(formDataToSend)
            }

            onSave()
            onOpenChange(false)
        } catch (error: any) {
            console.error('Error al guardar cliente:', error)
            console.error('Error completo:', JSON.stringify(error, null, 2))
            if (error?.response) {
                console.error('Response data:', error.response)
            }
            alert(`Error al guardar el cliente: ${error?.message || 'Error desconocido'}`)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (field: keyof Cliente, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }))

        // Validar teléfono en tiempo real
        if (field === 'phone') {
            const phoneStr = String(value)
            if (phoneStr && !/^\d{9}$/.test(phoneStr)) {
                setPhoneError("Debe tener 9 dígitos")
            } else {
                setPhoneError("")
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        {cliente ? <PencilLine className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        <DialogTitle>{cliente ? "Editar Cliente" : "Crear Cliente"}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {cliente ? "Modifica los datos del cliente" : "Completa los datos del nuevo cliente"}
                    </DialogDescription>
                </DialogHeader>

                <form id="cliente-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 px-1">
                    {/* Campos Obligatorios */}
                    <div className="space-y-4">

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="last_name">Apellidos *</Label>
                                <Input
                                    id="last_name"
                                    value={formData.last_name}
                                    onChange={(e) => handleChange('last_name', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="dni">DNI *</Label>
                                <Input
                                    id="dni"
                                    value={formData.dni}
                                    onChange={(e) => handleChange('dni', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono *</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    className={phoneError ? "border-red-500" : ""}
                                    required
                                />
                                {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    disabled={!!cliente?.id}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="session_credits">Sesiones *</Label>
                                    <Input
                                        id="session_credits"
                                        type="number"
                                        min="0"
                                        value={formData.session_credits}
                                        onChange={(e) => handleChange('session_credits', parseInt(e.target.value) || 0)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="class_credits">Clases *</Label>
                                    <Input
                                        id="class_credits"
                                        type="number"
                                        min="0"
                                        value={formData.class_credits}
                                        onChange={(e) => handleChange('class_credits', parseInt(e.target.value) || 0)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Campos Opcionales */}
                    <div className="space-y-4 pt-4 border-t">
                        {/* Foto y Dirección en la misma línea */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="photo">Foto</Label>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input
                                            id="photo"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) {
                                                    setPhotoFile(file)
                                                    // Crear preview
                                                    const reader = new FileReader()
                                                    reader.onloadend = () => {
                                                        setPhotoPreview(reader.result as string)
                                                    }
                                                    reader.readAsDataURL(file)
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor="photo"
                                            className="flex items-center justify-between h-10 px-3 py-2 text-sm rounded-md border border-input bg-background cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <span>
                                                {photoFile ? photoFile.name : "Elegir archivo"}
                                            </span>
                                            {photoFile && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        setPhotoFile(null)
                                                        setPhotoPreview(null)
                                                        // Reset file input
                                                        const input = document.getElementById('photo') as HTMLInputElement
                                                        if (input) input.value = ''
                                                    }}
                                                    className="ml-2 text-foreground hover:text-destructive text-lg font-semibold"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </label>
                                    </div>
                                    {photoPreview && (
                                        <div className="relative w-1/2 aspect-square rounded-lg overflow-hidden border">
                                            <img
                                                src={photoPreview}
                                                alt="Preview"
                                                className="object-cover w-full h-full"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Dirección</Label>
                                <Input
                                    id="address"
                                    value={formData.address || ""}
                                    onChange={(e) => handleChange('address', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Fecha de Nacimiento</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !fechaNacimiento && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {fechaNacimiento ? format(fechaNacimiento, "dd/MM/yyyy") : "Seleccionar fecha"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={fechaNacimiento}
                                            onSelect={handleDateSelect}
                                            captionLayout="dropdown"
                                            fromYear={1920}
                                            toYear={new Date().getFullYear()}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label>Edad</Label>
                                <Input
                                    value={edad !== null ? `${edad} años` : ""}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="occupation">Ocupación</Label>
                                <Input
                                    id="occupation"
                                    value={formData.occupation || ""}
                                    onChange={(e) => handleChange('occupation', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sport">Actividad Física</Label>
                                <Input
                                    id="sport"
                                    value={formData.sport || ""}
                                    onChange={(e) => handleChange('sport', e.target.value)}
                                />
                            </div>
                        </div>

                        <Collapsible className="rounded-lg border">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between p-4 h-auto rounded-none hover:bg-muted/50" type="button">
                                    <span className="font-semibold">Información Adicional</span>
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="border-t bg-muted/30 p-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label>Antecedentes</Label>
                                        <RichTextEditor
                                            value={formData.history || ""}
                                            onChange={(value) => handleChange('history', value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Diagnóstico</Label>
                                        <RichTextEditor
                                            value={formData.diagnosis || ""}
                                            onChange={(value) => handleChange('diagnosis', value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Alergias</Label>
                                        <RichTextEditor
                                            value={formData.allergies || ""}
                                            onChange={(value) => handleChange('allergies', value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Notas</Label>
                                        <RichTextEditor
                                            value={formData.notes || ""}
                                            onChange={(value) => handleChange('notes', value)}
                                        />
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>
                </form>

                <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="cliente-form" disabled={loading}>
                        {loading ? "Guardando..." : "Guardar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    )
}
