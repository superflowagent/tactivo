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
import { Label } from "@/components/ui/label";
import { error as logError } from "@/lib/logger";
import { Calendar } from "@/components/ui/calendar"
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { CalendarIcon, ChevronDown, UserPlus, PencilLine, User, Euro, CheckCircle, XCircle, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { getFilePublicUrl, supabase } from "@/lib/supabase"
import type { Cliente } from "@/types/cliente"
import type { Event } from "@/types/event"
import { useAuth } from "@/contexts/AuthContext"
import { EventDialog } from "@/components/eventos/EventDialog"

interface ClienteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    cliente?: Cliente | null
    onSave: () => void
}

export function ClienteDialog({ open, onOpenChange, cliente, onSave }: ClienteDialogProps) {
    const { companyId } = useAuth()
    const nameInputRef = useRef<HTMLInputElement | null>(null)
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
    const [removePhoto, setRemovePhoto] = useState(false)
    const [phoneError, setPhoneError] = useState<string>("")
    const [eventos, setEventos] = useState<Event[]>([])
    const [loadingEventos, setLoadingEventos] = useState(false)
    const [eventDialogOpen, setEventDialogOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
    const [activeTab, setActiveTab] = useState("datos")
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    useEffect(() => {
        if (cliente) {
            setFormData(cliente)
            if (cliente.birth_date) {
                const date = new Date(cliente.birth_date)
                setFechaNacimiento(date)
                calcularEdad(date)
            }
            // Cargar preview de foto existente (handled by storage)
            if (cliente.photo) {
                setPhotoPreview(getFilePublicUrl('users', cliente.id, cliente.photo) || null)
            } else {
                setPhotoPreview(null)
            }
            // Cargar eventos del cliente
            loadEventos(cliente.id!)
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
            setRemovePhoto(false)
            setEventos([])
        }
        setPhoneError("")

        // Autofocus removed per UX decision
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

    const loadEventos = async (clienteId: string) => {
        if (!clienteId) return

        setLoadingEventos(true)
        try {
            const { data: records, error } = await supabase.from('events').select('*').filter('client', 'cs', `{"${clienteId}"}`).eq('type', 'appointment').order('datetime', { ascending: false })
            if (error) throw error
            // Enrich professional field
            const profIds = new Set<string>()
                ; (records || []).forEach((r: any) => {
                    const pros = Array.isArray(r.professional) ? r.professional : (r.professional ? [r.professional] : [])
                    pros.forEach((id: string) => profIds.add(id))
                })
            let profileMap: Record<string, any> = {}
            if (profIds.size > 0) {
                const ids = Array.from(profIds)
                const { data: profiles } = await supabase.from('profiles').select('user_id, name, last_name').in('user_id', ids)
                    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p })
            }
            const enriched = (records || []).map((r: any) => ({
                ...r,
                expand: {
                    professional: (Array.isArray(r.professional) ? r.professional : (r.professional ? [r.professional] : [])).map((id: string) => profileMap[id] || null).filter(Boolean)
                }
            }))
            setEventos(enriched)
        } catch (err) {
            logError('Error al cargar eventos:', err)
        } finally {
            setLoadingEventos(false)
        }
    }

    const handleEditEvent = async (eventId: string) => {
        try {
            const { data: eventData, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
            if (error) throw error
            const ids = [...(Array.isArray(eventData.client) ? eventData.client : (eventData.client ? [eventData.client] : [])), ...(Array.isArray(eventData.professional) ? eventData.professional : (eventData.professional ? [eventData.professional] : []))]
            let profileMap: Record<string, any> = {}
            if (ids.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('user_id, name, last_name').in('user_id', ids)
                    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p })
            }
            const enriched = {
                ...eventData,
                expand: {
                    client: (Array.isArray(eventData.client) ? eventData.client : (eventData.client ? [eventData.client] : [])).map((id: string) => profileMap[id] || null).filter(Boolean),
                    professional: (Array.isArray(eventData.professional) ? eventData.professional : (eventData.professional ? [eventData.professional] : [])).map((id: string) => profileMap[id] || null).filter(Boolean),
                }
            }
            setSelectedEvent(enriched as any)
            setEventDialogOpen(true)
        } catch (err) {
            logError('Error cargando evento:', err)
        }
    }

    const handleEventSaved = () => {
        loadEventos(cliente?.id!)
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
            // Build payload object for non-file updates
            const payload: any = {}

            // Añadir campos regulares (excluyendo campos especiales y metadata)
            Object.entries(formData).forEach(([key, value]) => {
                if (key === 'id' || key === 'created' || key === 'updated' || key === 'photo' || key === 'birth_date' || key === 'email') return
                if (value !== undefined && value !== null && value !== '') {
                    if (key === 'session_credits' || key === 'class_credits') {
                        const parsed = parseInt(String(value))
                        payload[key] = String(isNaN(parsed) ? 0 : parsed)
                    } else {
                        payload[key] = String(value)
                    }
                }
            })

            // Email handling
            if (!cliente?.id) {
                if (formData.email) {
                    payload.email = formData.email
                    payload.emailVisibility = 'true'
                }
            } else if (formData.email && formData.email !== cliente.email) {
                payload.email = formData.email
                payload.emailVisibility = 'true'
            }

            // Fecha nacimiento
            if (fechaNacimiento) payload.birth_date = format(fechaNacimiento, "yyyy-MM-dd")

            // Role/company for new client
            if (!cliente?.id) {
                payload.role = 'client'
                if (companyId) payload.company = companyId
                const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10)
                payload.password = randomPassword
                payload.passwordConfirm = randomPassword
            }

            let savedUser: any = null

            if (photoFile) {
                // User photos are handled separately; do not attempt upload here. Save metadata if needed.
                // We'll store the filename in profile.photo but the actual upload must be performed externally.
                const filename = photoFile.name
                payload.photo = filename

                if (cliente?.id) {
                    const { data, error } = await supabase.from('profiles').update(payload).eq('user_id', cliente.id).select().maybeSingle()
                    if (error) throw error
                    savedUser = data
                } else {
                    const { data, error } = await supabase.from('profiles').insert(payload).select().single()
                    if (error) throw error
                    savedUser = data
                }
            } else {
                // No new file
                if (removePhoto && cliente?.id) payload.photo = null

                if (cliente?.id) {
                    const { data, error } = await supabase.from('profiles').update(payload).eq('user_id', cliente.id).select().maybeSingle()
                    if (error) throw error
                    savedUser = data
                } else {
                    const { data, error } = await supabase.from('profiles').insert(payload).select().single()
                    if (error) throw error
                    savedUser = data
                }
            }

            // Sync user_cards
            import('@/lib/userCards').then(({ syncUserCardOnUpsert }) => {
                try { syncUserCardOnUpsert(savedUser) } catch (e) { /* ignore */ }
            })

            onSave()
            onOpenChange(false)
            setRemovePhoto(false)
        } catch (err: any) {
            logError('Error al guardar cliente:', err)
            logError('Error completo:', JSON.stringify(err, null, 2))
            if (err?.response) {
                logError('Response data:', err.response)
            }
            alert(`Error al guardar el cliente: ${err?.message || 'Error desconocido'}`)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!cliente?.id) return

        try {
            setLoading(true)
            await supabase.from('profiles').delete().eq('user_id', cliente.id)

            // user_cards is deprecated — no-op
            const userIdToDelete = cliente.id!
            import('@/lib/userCards').then(({ deleteUserCardForUser }) => {
                try { deleteUserCardForUser(userIdToDelete) } catch (e) { /* ignore */ }
            })

            onSave()
            onOpenChange(false)
            setShowDeleteDialog(false)
        } catch (err: any) {
            logError('Error al eliminar cliente:', err)
            alert(`Error al eliminar el cliente: ${err?.message || 'Error desconocido'}`)
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
        <>
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

                    <Tabs defaultValue="datos" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="datos">Datos</TabsTrigger>
                            <TabsTrigger value="historial" disabled={!cliente?.id}>Citas</TabsTrigger>
                        </TabsList>

                        <TabsContent value="datos" className="flex-1 overflow-y-auto mt-4">
                            <form id="cliente-form" onSubmit={handleSubmit} className="space-y-6 px-1">
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
                                                ref={(el: HTMLInputElement) => nameInputRef.current = el}
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
                                                    type="text"
                                                    value={String(formData.session_credits ?? '')}
                                                    onChange={(e) => handleChange('session_credits', e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="class_credits">Clases *</Label>
                                                <Input
                                                    id="class_credits"
                                                    type="text"
                                                    value={String(formData.class_credits ?? '')}
                                                    onChange={(e) => handleChange('class_credits', e.target.value)}
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
                                                                setRemovePhoto(false)
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
                        </TabsContent>

                        <TabsContent value="historial" className="flex-1 overflow-y-auto mt-4">
                            <div className="space-y-4 px-1">
                                {loadingEventos ? (
                                    <div className="flex items-center justify-center py-8">
                                        <p className="text-muted-foreground">Cargando historial...</p>
                                    </div>
                                ) : eventos.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                        <p className="text-muted-foreground">No hay citas registradas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {eventos.map((evento) => {
                                            const fecha = new Date(evento.datetime)
                                            const profesionalNames = Array.isArray(evento.expand?.professional)
                                                ? evento.expand.professional.map((p: any) => `${p.name} ${p.last_name}`).join(', ')
                                                : evento.expand?.professional
                                                    ? `${(evento.expand.professional as any).name} ${(evento.expand.professional as any).last_name}`
                                                    : 'Sin asignar'

                                            return (
                                                <Card key={evento.id} className="p-4">
                                                    <div className="grid grid-cols-6 gap-4 items-center">
                                                        <div className="flex items-center gap-2">
                                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                            <div>
                                                                <p className="text-sm">{format(fecha, 'dd/MM/yyyy')}</p>
                                                                <p className="text-sm text-muted-foreground">{format(fecha, 'HH:mm')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 col-span-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <p className="text-sm">{profesionalNames}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Euro className="h-4 w-4 text-muted-foreground" />
                                                            <p className="text-sm font-medium">{evento.cost || 0}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {evento.paid ? (
                                                                <div className="flex items-center gap-1 text-green-600">
                                                                    <CheckCircle className="h-4 w-4" />
                                                                    <span className="text-sm">Pagada</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-red-600">
                                                                    <XCircle className="h-4 w-4" />
                                                                    <span className="text-sm">No pagada</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEditEvent(evento.id!)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="mt-4">
                        <div className="flex w-full justify-between">
                            <div>
                                {cliente?.id && activeTab === "datos" && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={() => setShowDeleteDialog(true)}
                                        disabled={loading}
                                    >
                                        Eliminar
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" form="cliente-form" disabled={loading}>
                                    {loading ? "Guardando..." : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <EventDialog
                open={eventDialogOpen}
                onOpenChange={setEventDialogOpen}
                event={selectedEvent}
                onSave={handleEventSaved}
            />
        </>
    )
}
