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
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { CalendarIcon, CalendarPlus, Edit, Trash, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import pb from "@/lib/pocketbase"
import type { Event } from "@/types/event"
import type { Cliente } from "@/types/cliente"
import { useAuth } from "@/contexts/AuthContext"
import { onEventCreate, onEventUpdate, onEventDelete } from "@/lib/creditManager"

interface EventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    event?: Event | null
    onSave: () => void
    initialDateTime?: string | null
}

export function EventDialog({ open, onOpenChange, event, onSave, initialDateTime }: EventDialogProps) {
    const { companyId } = useAuth()
    const [formData, setFormData] = useState<Partial<Event>>({
        type: 'appointment',
        duration: 60,
        cost: 0,
        paid: false,
        notes: '',
    })
    const [fecha, setFecha] = useState<Date | undefined>(undefined)
    const [hora, setHora] = useState<string>('10:00')
    const [minutos, setMinutos] = useState<string>('00')
    const [dias, setDias] = useState<number>(1)
    const [horasVacaciones, setHorasVacaciones] = useState<number>(0)
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [profesionales, setProfesionales] = useState<any[]>([])
    const [selectedClients, setSelectedClients] = useState<string[]>([])
    const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([])
    const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
    const [clientSearch, setClientSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [company, setCompany] = useState<any>(null)
    const [showMaxAssistantsDialog, setShowMaxAssistantsDialog] = useState(false)

    useEffect(() => {
        if (showMaxAssistantsDialog) {
            const timer = setTimeout(() => {
                setShowMaxAssistantsDialog(false)
            }, 4000)
            return () => clearTimeout(timer)
        }
    }, [showMaxAssistantsDialog])

    useEffect(() => {
        if (open) {
            loadClientes()
            loadProfesionales()
            loadCompany()
        }

        if (event) {
            setFormData(event)
            setSelectedClients(event.client || [])
            setSelectedProfessionals(event.professional || [])
            setClientSearch('')
            if (event.datetime) {
                const date = new Date(event.datetime)
                setFecha(date)
                const hours = date.getHours().toString().padStart(2, '0')
                const mins = date.getMinutes().toString().padStart(2, '0')
                setHora(hours)
                setMinutos(mins)
            }

            // Calcular días y horas para eventos de tipo vacaciones
            if (event.type === 'vacation' && event.duration) {
                const totalMinutes = event.duration
                const days = Math.floor(totalMinutes / (24 * 60))
                const remainingMinutes = totalMinutes % (24 * 60)
                const hours = Math.floor(remainingMinutes / 60)

                setDias(days)
                setHorasVacaciones(hours)
            }
        } else {
            // Fecha por defecto: hoy o fecha clickeada
            let defaultDate = new Date()
            let defaultHora = ''
            let defaultMinutos = '00'

            if (initialDateTime) {
                // Usar la fecha/hora clickeada del calendario
                defaultDate = new Date(initialDateTime)
                defaultHora = defaultDate.getHours().toString().padStart(2, '0')
                defaultMinutos = defaultDate.getMinutes().toString().padStart(2, '0')
            } else {
                // Hora por defecto: siguiente hora disponible (hora actual + 1, redondeada)
                const nextHour = new Date()
                nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0) // +1 hora, minutos en :00
                defaultHora = nextHour.getHours().toString().padStart(2, '0')
            }

            setFecha(defaultDate)
            setFormData({
                type: 'appointment',
                duration: 60,
                cost: 0,
                paid: false,
                notes: '',
            })
            setSelectedClients([])
            setSelectedProfessionals([])
            setClientSearch('')
            setHora(defaultHora)
            setMinutos(defaultMinutos)
            setDias(1)
            setHorasVacaciones(0)
        }
    }, [event, open, initialDateTime])
    const loadCompany = async () => {
        if (!companyId) return
        try {
            const record = await pb.collection('companies').getOne(companyId)
            setCompany(record)
        } catch (error) {
            console.error('Error cargando company:', error)
        }
    }
    const loadClientes = async () => {
        if (!companyId) return

        try {
            const records = await pb.collection('users').getFullList<Cliente>({
                filter: `role="client" && company="${companyId}"`,
                sort: 'name',
            })
            setClientes(records)
        } catch (error) {
            console.error('Error cargando clientes:', error)
        }
    }

    const loadProfesionales = async () => {
        if (!companyId) return

        try {
            const records = await pb.collection('users').getFullList({
                filter: `role="professional" && company="${companyId}"`,
                sort: 'name',
            })
            setProfesionales(records)
        } catch (error) {
            console.error('Error cargando profesionales:', error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (!fecha) {
                alert('Por favor selecciona una fecha')
                return
            }

            // Combinar fecha y hora
            const datetime = new Date(fecha)
            datetime.setHours(parseInt(hora), parseInt(minutos), 0, 0)

            // Calcular duración según tipo
            let duration = formData.duration || 60
            if (formData.type === 'vacation') {
                duration = (dias * 24 * 60) + (horasVacaciones * 60)
            }

            const data = {
                ...formData,
                datetime: datetime.toISOString(),
                duration,
                client: selectedClients,
                professional: selectedProfessionals,
            }

            if (event?.id) {
                // Update: adjust credits based on changes
                await onEventUpdate(event, data)
                await pb.collection('events').update(event.id, data)
            } else {
                // Create: deduct credits for assigned clients
                const dataWithCompany = {
                    ...data,
                    company: companyId,
                }
                await pb.collection('events').create(dataWithCompany)
                await onEventCreate(dataWithCompany)
            }

            onSave()
            onOpenChange(false)
        } catch (error) {
            console.error('Error al guardar evento:', error)
            alert('Error al guardar el evento')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!event?.id) return

        try {
            setLoading(true)
            // Refund credits before deleting
            await onEventDelete(event)
            await pb.collection('events').delete(event.id)
            onSave()
            onOpenChange(false)
            setShowDeleteDialog(false)
        } catch (error: any) {
            console.error('Error al eliminar evento:', error)
            alert(`Error al eliminar el evento: ${error?.message || 'Error desconocido'}`)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (field: keyof Event, value: any) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value }

            // Auto-ajustar duración según tipo
            if (field === 'type') {
                if (value === 'appointment') {
                    newData.duration = 60
                } else if (value === 'class') {
                    newData.duration = 90
                }
            }

            return newData
        })
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {event?.id ? <Edit className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
                            {event?.id ? 'Editar Evento' : 'Crear Evento'}
                        </DialogTitle>
                        <DialogDescription>
                            {event?.id ? 'Modifica los datos del evento' : 'Completa los datos del nuevo evento'}
                        </DialogDescription>
                    </DialogHeader>

                    <form id="event-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 px-1">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Tipo *</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value) => handleChange('type', value as Event['type'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona un tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="appointment">Cita</SelectItem>
                                            <SelectItem value="class">Clase</SelectItem>
                                            <SelectItem value="vacation">Vacaciones</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    {formData.type === 'vacation' ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="dias">Días *</Label>
                                                <Input
                                                    id="dias"
                                                    type="number"
                                                    min="0"
                                                    value={dias}
                                                    onChange={(e) => setDias(parseInt(e.target.value) || 0)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="horas-vac">Horas *</Label>
                                                <Input
                                                    id="horas-vac"
                                                    type="number"
                                                    min="0"
                                                    max="23"
                                                    value={horasVacaciones}
                                                    onChange={(e) => setHorasVacaciones(parseInt(e.target.value) || 0)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Label htmlFor="duration">Duración (min) *</Label>
                                            <Input
                                                id="duration"
                                                type="number"
                                                min="1"
                                                value={formData.duration}
                                                onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                                                required
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !fecha && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {fecha ? format(fecha, "dd/MM/yyyy") : "Seleccionar fecha"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={fecha}
                                                onSelect={setFecha}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="hora">Hora *</Label>
                                    <div className="flex gap-2">
                                        <Select value={hora} onValueChange={setHora}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                                                    <SelectItem key={h} value={h.toString().padStart(2, '0')}>
                                                        {h.toString().padStart(2, '0')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <span className="flex items-center">:</span>
                                        <Select value={minutos} onValueChange={setMinutos}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['00', '15', '30', '45'].map((m) => (
                                                    <SelectItem key={m} value={m}>
                                                        {m}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {formData.type !== 'vacation' && (
                                <div className="space-y-2">
                                    <Label>
                                        {formData.type === 'appointment' ? 'Cliente' : 'Clientes'}
                                        {formData.type === 'class' && company?.max_class_assistants && (
                                            <span className="text-muted-foreground ml-2">
                                                ({selectedClients.length}/{company.max_class_assistants})
                                            </span>
                                        )}
                                    </Label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {selectedClients.map((clientId) => {
                                            const cliente = clientes.find(c => c.id === clientId)
                                            return cliente ? (
                                                <div key={clientId} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm">
                                                    <span>{cliente.name} {cliente.last_name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedClients(prev => prev.filter(id => id !== clientId))}
                                                        className="hover:text-destructive"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ) : null
                                        })}
                                    </div>
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Buscar cliente..."
                                            value={clientSearch}
                                            onChange={(e) => setClientSearch(e.target.value)}
                                            className="text-sm"
                                        />
                                        {clientSearch && (
                                            <div className="border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 absolute z-50 bg-background">
                                                {clientes
                                                    .filter(cliente => {
                                                        const normalizedSearch = clientSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                                                        const normalizedClientName = (cliente.name + ' ' + cliente.last_name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                                                        return normalizedClientName.includes(normalizedSearch)
                                                    })
                                                    .filter(cliente => !selectedClients.includes(cliente.id!))
                                                    .map((cliente) => {
                                                        const photoUrl = cliente.photo
                                                            ? `https://pocketbase.superflow.es/api/files/users/${cliente.id}/${cliente.photo}`
                                                            : null
                                                        return (
                                                            <button
                                                                key={cliente.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    // Validar límite de asistentes para clases
                                                                    if (formData.type === 'class' && company?.max_class_assistants && selectedClients.length >= company.max_class_assistants) {
                                                                        setShowMaxAssistantsDialog(true)
                                                                        return
                                                                    }
                                                                    setSelectedClients(prev => [...prev, cliente.id!])
                                                                    setClientSearch('')
                                                                }}
                                                                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm block flex items-center gap-2"
                                                            >
                                                                {photoUrl ? (
                                                                    <img
                                                                        src={photoUrl}
                                                                        alt={`${cliente.name} ${cliente.last_name}`}
                                                                        className="h-8 w-8 rounded object-cover flex-shrink-0"
                                                                    />
                                                                ) : (
                                                                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                                                        {cliente.name.charAt(0)}{cliente.last_name.charAt(0)}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 flex items-center justify-between">
                                                                    <span>{cliente.name} {cliente.last_name}</span>
                                                                    {formData.type === 'class' && (
                                                                        <span className={`text-xs font-medium ml-2 ${(cliente.class_credits || 0) <= 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                                                                            {cliente.class_credits || 0} créditos
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>{formData.type === 'vacation' ? 'Profesionales' : 'Profesional'}</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {selectedProfessionals.map((profId) => {
                                        const prof = profesionales.find(p => p.id === profId)
                                        return prof ? (
                                            <div key={profId} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm">
                                                <span>{prof.name} {prof.last_name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedProfessionals(prev => prev.filter(id => id !== profId))}
                                                    className="hover:text-destructive"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : null
                                    })}
                                </div>
                                <Select
                                    value=""
                                    onValueChange={(value) => {
                                        if (value && !selectedProfessionals.includes(value)) {
                                            setSelectedProfessionals(prev => [...prev, value])
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Añadir profesional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {profesionales.map((prof) => (
                                            <SelectItem key={prof.id} value={prof.id}>
                                                {prof.name} {prof.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.type === 'appointment' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="cost">Coste (€) *</Label>
                                            <Input
                                                id="cost"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={formData.cost}
                                                onChange={(e) => handleChange('cost', parseFloat(e.target.value))}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Pagado</Label>
                                            <div className="flex items-center h-10">
                                                <Checkbox
                                                    id="paid"
                                                    checked={formData.paid}
                                                    onCheckedChange={(checked) => handleChange('paid', checked)}
                                                />
                                                <label
                                                    htmlFor="paid"
                                                    className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    Sí
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <Label>Notas</Label>
                                <RichTextEditor
                                    value={formData.notes || ""}
                                    onChange={(value) => handleChange('notes', value)}
                                    placeholder=""
                                />
                            </div>
                        </div>
                    </form>

                    <DialogFooter className="mt-4">
                        <div className="flex w-full justify-between">
                            <div>
                                {event?.id && (
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
                                <Button type="submit" form="event-form" disabled={loading}>
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
                        <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
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

            {showMaxAssistantsDialog && (
                <div className="fixed bottom-4 right-4 left-4 md:left-auto z-[100] w-auto md:max-w-md animate-in slide-in-from-right">
                    <Alert variant="destructive" className="[&>svg]:top-3.5 [&>svg+div]:translate-y-0 bg-[hsl(var(--background))]">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Número máximo de asistentes alcanzado</AlertTitle>
                        <AlertDescription>
                            El número máximo de clientes para las clases es {company?.max_class_assistants}.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </>
    )
}
