import { useState, useEffect, useRef } from "react"
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
import { CalendarIcon, UserStar, X } from "lucide-react"
import { cn, shouldAutoFocus } from "@/lib/utils"
import { error } from '@/lib/logger'
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
    const nameInputRef = useRef<HTMLInputElement | null>(null)
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

    useEffect(() => {
        if (open && shouldAutoFocus()) {
            setTimeout(() => {
                nameInputRef.current?.focus()
            }, 50)
        }
    }, [open])
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
            if (!profesional?.id) {
                // Creación: siempre añadir email
                if (formData.email) {
                    formDataToSend.append('email', formData.email)
                    formDataToSend.append('emailVisibility', 'true')
                }
            } else if (formData.email && formData.email !== profesional.email) {
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

            // Añadir role si es nuevo profesional
            if (!profesional?.id) {
                formDataToSend.append('role', 'professional')
                // Auto-asignar company del profesional logueado
                if (companyId) {
                    formDataToSend.append('company', companyId)
                }
                // Generar contraseña automática para nuevos profesionales (requerido por PocketBase)
                const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10)
                formDataToSend.append('password', randomPassword)
                formDataToSend.append('passwordConfirm', randomPassword)
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
        } catch (err) {
            error('Error al guardar profesional:', err)
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

                <form id="profesional-form" onSubmit={handleSubmit}>
                    <div className="space-y-6 py-4">
                        {/* Datos personales */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre *</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ''}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                    ref={(el: HTMLInputElement) => nameInputRef.current = el}
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
                                disabled={!!profesional?.id}
                                required
                            />
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
                                            onChange={handlePhotoChange}
                                        />
                                        <label
                                            htmlFor="photo"
                                            className="flex items-center justify-between h-10 px-3 py-2 text-sm rounded-md border border-border bg-background cursor-pointer hover:bg-muted hover:text-foreground"
                                        >
                                            <span>
                                                {photoFile ? photoFile.name : "Elegir archivo"}
                                            </span>
                                            {(photoFile || photoPreview) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        setPhotoFile(null)
                                                        setPhotoPreview(null)
                                                        setFormData(prev => ({ ...prev, photo: '' }))
                                                        const input = document.getElementById('photo') as HTMLInputElement
                                                        if (input) input.value = ''
                                                    }}
                                                    className="ml-2 text-foreground hover:text-destructive p-1 rounded"
                                                    aria-label="Borrar foto"
                                                >
                                                    <X className="h-4 w-4" />
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
                                    value={formData.address || ''}
                                    onChange={(e) => handleChange('address', e.target.value)}
                                />
                            </div>

                            {/* Fecha de nacimiento + edad con Notas debajo en toda la fila */}
                            <div className="col-span-2 space-y-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Fecha de Nacimiento</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal h-10",
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
                                            className="bg-muted h-10"
                                        />
                                    </div>
                                </div>

                                {/* Notas (debajo de fecha, ocupando toda la fila) */}
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notas</Label>
                                    <RichTextEditor
                                        value={formData.notes || ''}
                                        onChange={(html) => handleChange('notes', html)}
                                        placeholder="Añade notas sobre el profesional..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="profesional-form" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
