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
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { CalendarIcon, UserStar } from "lucide-react"
import { cn } from "@/lib/utils"
import pb from "@/lib/pocketbase"
import { useAuth } from "@/contexts/AuthContext"

interface Profesional {
    id?: string
    name: string
    last_name: string
    dni: string
    email: string
    phone: string
    company: string
    photo?: string
    birth_date?: string
    address?: string
    notes?: string
    role?: string
}

interface ProfesionalDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    profesional?: Profesional | null
    onSave: () => void
}

export function ProfesionalDialog({ open, onOpenChange, profesional, onSave }: ProfesionalDialogProps) {
    const { companyId } = useAuth()
    const [formData, setFormData] = useState<Profesional>({
        name: "",
        last_name: "",
        dni: "",
        email: "",
        phone: "",
        company: "",
    })
    const [fechaNacimiento, setFechaNacimiento] = useState<Date | undefined>(undefined)
    const [edad, setEdad] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [phoneError, setPhoneError] = useState<string>("")

    useEffect(() => {
        if (profesional) {
            setFormData(profesional)
            if (profesional.birth_date) {
                const date = new Date(profesional.birth_date)
                setFechaNacimiento(date)
                calcularEdad(date)
            }
            // Cargar preview de foto existente
            if (profesional.photo) {
                setPhotoPreview(pb.files.getURL(profesional, profesional.photo))
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
                address: "",
                notes: "",
            })
            setFechaNacimiento(undefined)
            setEdad(null)
            setPhotoFile(null)
            setPhotoPreview(null)
        }
        setPhoneError("")
    }, [profesional, open])

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
        setLoading(true)

        try {
            const formDataToSend = new FormData()

            // Añadir campos regulares
            Object.entries(formData).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formDataToSend.append(key, String(value))
                }
            })

            // Añadir foto si hay una nueva
            if (photoFile) {
                formDataToSend.append('photo', photoFile)
            }

            // Añadir fecha de nacimiento
            if (fechaNacimiento) {
                formDataToSend.append('birth_date', format(fechaNacimiento, "yyyy-MM-dd"))
            }

            // Añadir role si es nuevo profesional
            if (!profesional?.id) {
                formDataToSend.append('role', 'professional')
                // Auto-asignar company del profesional logueado
                if (companyId) {
                    formDataToSend.append('company', companyId)
                }
            }

            if (profesional?.id) {
                // Actualizar profesional existente
                await pb.collection('users').update(profesional.id, formDataToSend)
            } else {
                // Crear nuevo profesional
                await pb.collection('users').create(formDataToSend)
            }

            onSave()
            onOpenChange(false)
        } catch (error) {
            console.error('Error al guardar profesional:', error)
            alert('Error al guardar el profesional')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (field: keyof Profesional, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }))

        // Validar teléfono en tiempo real
        if (field === 'phone') {
            const phoneStr = String(value)
            if (phoneStr && !/^\+?\d{9,15}$/.test(phoneStr.replace(/\s/g, ''))) {
                setPhoneError('Formato de teléfono inválido')
            } else {
                setPhoneError('')
            }
        }
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <UserStar className="h-5 w-5" />
                        <DialogTitle>{profesional ? "Editar Profesional" : "Crear Profesional"}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {profesional ? "Modifica los datos del profesional" : "Completa los datos del nuevo profesional"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-6 py-4">
                        {/* Foto */}
                        <div className="space-y-2">
                            <Label htmlFor="photo">Foto</Label>
                            <div className="flex items-center gap-4">
                                {photoPreview && (
                                    <img
                                        src={photoPreview}
                                        alt="Preview"
                                        className="w-20 h-20 rounded-md object-cover"
                                    />
                                )}
                                <Input
                                    id="photo"
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                />
                            </div>
                        </div>

                        {/* Datos personales */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre *</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ''}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="last_name">Apellidos *</Label>
                                <Input
                                    id="last_name"
                                    value={formData.last_name || ''}
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
                                    value={formData.dni || ''}
                                    onChange={(e) => handleChange('dni', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono *</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone || ''}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    required
                                />
                                {phoneError && (
                                    <p className="text-sm text-destructive">{phoneError}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email || ''}
                                onChange={(e) => handleChange('email', e.target.value)}
                                required
                            />
                        </div>

                        {/* Fecha de nacimiento */}
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
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {edad !== null && (
                                <div className="space-y-2">
                                    <Label>Edad</Label>
                                    <Input
                                        value={`${edad} años`}
                                        disabled
                                        className="bg-muted"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dirección */}
                        <div className="space-y-2">
                            <Label htmlFor="address">Dirección</Label>
                            <Input
                                id="address"
                                value={formData.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                            />
                        </div>

                        {/* Notas */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notas</Label>
                            <RichTextEditor
                                content={formData.notes || ''}
                                onChange={(html) => handleChange('notes', html)}
                                placeholder="Añade notas sobre el profesional..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
