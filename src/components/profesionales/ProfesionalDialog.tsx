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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { CalendarIcon, UserStar, X, Mail, CheckCircle } from "lucide-react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { error } from '@/lib/logger'
import { getFilePublicUrl, supabase } from "@/lib/supabase"
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

    // Autofocus removed per UX decision
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    // removePhoto state to allow clearing preview / file during edit
    const [removePhoto, setRemovePhoto] = useState(false)
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
            if (profesional.photo_path) {
                setPhotoPreview(getFilePublicUrl('users', profesional.id, profesional.photo_path))
            } else {
                setPhotoPreview(null)
            }
            setRemovePhoto(false)

            // Ensure the user_cards entry is up to date when opening the dialog for an existing profesional
            if (profesional?.id) {
                import('@/lib/userCards').then(({ syncUserCardOnUpsert }) => {
                    try { syncUserCardOnUpsert(profesional) } catch { /* ignore */ }
                })
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

    const [sendingReset, setSendingReset] = useState(false)
    const [showResetSent, setShowResetSent] = useState(false)

    const handleSendResetConfirm = async () => {
        if (!formData.email) {
            alert('El profesional no tiene email')
            return
        }
        setSendingReset(true)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(formData.email, { redirectTo: window.location.origin + '/auth/password-reset' })
            if (error) throw error
            setShowResetSent(true)
            setTimeout(() => setShowResetSent(false), 5000)
        } catch (err: any) {
            error('Error enviando reset:', err)
            alert(err?.message || 'Error enviando reset de contraseña')
        } finally {
            setSendingReset(false)
        }
    }

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
            // Build payload for non-file updates
            const payload: any = {}
            Object.entries(formData).forEach(([key, value]) => {
                if (key === 'id' || key === 'created' || key === 'updated' || key === 'photo' || key === 'birth_date' || key === 'email') return
                if (value !== undefined && value !== null && value !== '') payload[key] = String(value)
            })

            // Email
            if (!profesional?.id) {
                if (formData.email) {
                    payload.email = formData.email
                    payload.emailVisibility = 'true'
                }
            } else if (formData.email && formData.email !== profesional.email) {
                payload.email = formData.email
                payload.emailVisibility = 'true'
            }

            // Fecha
            if (fechaNacimiento) payload.birth_date = format(fechaNacimiento, "yyyy-MM-dd")

            // Role/company for create
            if (!profesional?.id) {
                payload.role = 'professional'
                if (companyId) payload.company = companyId
                const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10)
                payload.password = randomPassword
                payload.passwordConfirm = randomPassword
            }

            let savedUser: any = null

            // Use helper to update or insert profile, regardless of schema
            const api = await import('@/lib/supabase')
            if (profesional?.id) {
                const res = await api.updateProfileByUserId(profesional.id, payload)
                if (res?.error) throw res.error
                savedUser = res.data
            } else {
                const { data, error } = await supabase.from('profiles').insert(payload).select().single()
                if (error) throw error
                savedUser = data
            }

            // If a new photo file was selected, upload it to storage and update profile.photo_path
            if (photoFile && savedUser?.id) {
                try {
                    const filename = photoFile.name
                    const storagePath = `${savedUser.id}/${filename}`
                    const { error: uploadErr } = await supabase.storage.from('users').upload(storagePath, photoFile, { upsert: true })
                    if (uploadErr) throw uploadErr

                    // Update profile with photo_path using robust helper
                    const upd = await api.updateProfileByUserId(savedUser.id, { photo_path: filename })
                    if (upd?.error) throw upd.error

                    // Update preview to public url
                    setPhotoPreview(getFilePublicUrl('users', savedUser.id, filename))
                } catch (e) {
                    // Non-fatal: log and continue
                    error('Error subiendo foto:', e)
                }
            } else if (removePhoto && savedUser?.id) {
                try {
                    // Remove photo_path from profile
                    const rem = await api.updateProfileByUserId(savedUser.id, { photo_path: null })
                    if (rem?.error) throw rem.error
                    setPhotoPreview(null)
                } catch (e) {
                    error('Error removiendo foto:', e)
                }
            }

            // Sync user_cards (best-effort)
            import('@/lib/userCards').then(({ syncUserCardOnUpsert }) => {
                try { syncUserCardOnUpsert(savedUser) } catch { /* ignore */ }
            })

            onSave()
            onOpenChange(false)
            setRemovePhoto(false)

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
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <UserStar className="h-5 w-5" />
                            <DialogTitle>{profesional ? "Editar Profesional" : "Crear Profesional"}</DialogTitle>
                        </div>
                        <DialogDescription>
                            {profesional ? "Modifica los datos del profesional" : "Completa los datos del nuevo profesional"}
                        </DialogDescription>
                    </DialogHeader>

                    <form id="profesional-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 px-1 mt-4">
                        <div className="space-y-4">
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
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        disabled={!!profesional?.id}
                                        required
                                        className="w-full h-10"
                                    />

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleSendResetConfirm}
                                        disabled={!profesional?.id || !formData.email || sendingReset}
                                        className="w-full justify-center h-10"
                                    >
                                        <Mail className="mr-2 h-4 w-4" />
                                        {sendingReset ? 'Enviando...' : 'Restablecer contraseña'}
                                    </Button>
                                </div>
                            </div>
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
                                                    handlePhotoChange(e)
                                                    setRemovePhoto(false)
                                                }}
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
                                                            setRemovePhoto(true)
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
                        <div className="flex-1" />

                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>

                            <Button type="submit" form="profesional-form" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>


            </Dialog>

            {
                showResetSent && createPortal(
                    <div className="fixed bottom-4 right-4 z-[99999] w-96 pointer-events-none">
                        <div className="pointer-events-auto">
                            <Alert variant="success" className="shadow-lg [&>svg]:top-3.5 [&>svg+div]:translate-y-0">
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <div className="flex items-start gap-2">
                                        <div>
                                            <p className="font-semibold text-green-800">Email enviado a {formData.email}</p>
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>,
                    document.body
                )
            }
        </>
    )
}
