import { useState, useEffect, useRef, useMemo } from "react"
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
import { CalendarIcon, CalendarPlus, Edit, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { error as logError } from '@/lib/logger'
import type { Event } from "@/types/event"
import { useAuth } from "@/contexts/AuthContext"

// user_cards removed; fetch profile data directly from `profiles`
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { supabase, getFilePublicUrl } from '@/lib/supabase'
import { getProfilesByRole } from '@/lib/profiles'
import { formatDateAsDbLocalString } from '@/lib/utils'
import { formatDateWithOffset } from '@/lib/date'

interface EventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    event?: Event | null
    onSave: () => void
    initialDateTime?: string | null
}

export function EventDialog({ open, onOpenChange, event, onSave, initialDateTime }: EventDialogProps) {
    const { companyId, user } = useAuth()
    const isClientView = user?.role === 'client'
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
    const [clientes, setClientes] = useState<any[]>([])
    const [profesionales, setProfesionales] = useState<any[]>([])
    const [selectedClients, setSelectedClients] = useState<string[]>([])
    const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([])
    const [clientSearch, setClientSearch] = useState('')
    const [profilesMap, setProfilesMap] = useState<Record<string, any>>({})
    const [profilesLoading, setProfilesLoading] = useState(false)
    const [clientCredits, setClientCredits] = useState<number | null>(null)

    useEffect(() => {
        let mounted = true
        if (!selectedClients || selectedClients.length === 0) {
            setProfilesMap({})
            return
        }

        ; (async () => {
            try {
                setProfilesLoading(true)
                if (!selectedClients || selectedClients.length === 0) {
                    setProfilesMap({})
                    return
                }
                // Use secure RPCs instead of direct SELECTs (RLS & column restrictions applied)
                let results: any[] = []

                if (isClientView && event?.id) {
                    // Clients can only use RPC that returns id, name, last_name, photo_path for attendees
                    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_event_attendee_profiles', { p_event: event.id })
                    if (rpcErr) throw rpcErr
                    results = rpcData || []
                } else {
                    // Professionals (or admin): use RPC that returns full profiles for the selected ids
                    const ids = [...selectedClients, ...selectedProfessionals]
                    if (ids.length > 0) {
                        const { data: profs, error: profErr } = await supabase.rpc('get_profiles_by_ids_for_professionals', { p_ids: ids })
                        if (profErr) throw profErr
                        results = profs || []
                    } else {
                        results = []
                    }
                }

                const map: Record<string, any> = {}
                    ; (results || []).forEach((p: any) => {
                        const uid = p.user_id || p.user || p.id
                        map[uid] = {
                            user: uid,
                            name: p.name || '',
                            last_name: p.last_name || '',
                            photo: p.photo_path || null,
                            photoUrl: p.photo_path ? getFilePublicUrl('profile_photos', uid, p.photo_path) : null,
                            class_credits: typeof p.class_credits !== 'undefined' ? p.class_credits : 0,
                        }
                    })

                if (!mounted) return
                setProfilesMap(map)
                // No UI warning for missing profiles; leave placeholders empty if not found
            } catch (err) {
                logError('Error cargando perfiles para asistentes:', err)
            } finally {
                if (mounted) setProfilesLoading(false)
            }
        })()

        return () => { mounted = false }
    }, [selectedClients])
    const clientSearchRef = useRef<HTMLInputElement | null>(null)
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
            // Solo cargar la lista completa de clientes si NO es vista cliente (los clientes no necesitan buscar)
            if (!isClientView) loadClientes()
            loadProfesionales()
            loadCompany()
        }

        // Cargar créditos del cliente cuando el diálogo se abra (solo vista cliente)
        if (isClientView && user?.id && open) {
            let mounted = true
                ; (async () => {
                    try {
                        const fetcher = await import('@/lib/supabase')
                        const profile = await fetcher.fetchProfileByUserId(user.id)
                        if (!mounted) return
                        setClientCredits(profile?.class_credits ?? 0)
                    } catch (err) {
                        logError('Error cargando créditos del usuario:', err)
                        if (mounted) setClientCredits(0)
                    }
                })()
            // cleanup
            return () => { mounted = false }
        }

        if (event) {
            // Merge with defaults to avoid removing controlled fields (prevent controlled -> uncontrolled warnings)
            setFormData(prev => ({ ...prev, ...event }))
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

    // Autofocus removed per UX decision
    const loadCompany = async () => {
        if (!companyId) return
        try {
            // Use RPC to fetch company row and avoid RLS/permission issues
            const { data: comp, error: compErr } = await supabase.rpc('get_company_by_id', { p_company: companyId })
            if (compErr) throw compErr
            const record = Array.isArray(comp) ? comp[0] : comp
            setCompany(record)
        } catch (err) {
            logError('Error cargando company:', err)
        }
    }
    const loadClientes = async () => {
        if (!companyId) return

        try {
            const records = await getProfilesByRole(companyId, 'client')
            setClientes(records)
        } catch (err) {
            logError('Error cargando clientes desde profiles:', err)
        }
    }

    const loadProfesionales = async () => {
        if (!companyId) return

        try {
            const records = await getProfilesByRole(companyId, 'professional')
            setProfesionales(records)
        } catch (err) {
            logError('Error cargando profesionales desde profiles:', err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isClientView) return
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
                // Save with explicit timezone offset to preserve wall-clock time across server timezone
                datetime: formatDateWithOffset(datetime),
                duration,
                client: formData.type === 'vacation' ? [] : selectedClients,
                professional: selectedProfessionals,
            }

            // Only include allowed columns to avoid sending client-only properties like `expand`
            const allowed = ['title', 'type', 'duration', 'cost', 'paid', 'notes', 'datetime', 'client', 'professional', 'company']
            const sanitize = (obj: any) => {
                const out: any = {}
                allowed.forEach(k => {
                    if (typeof obj[k] !== 'undefined') out[k] = obj[k]
                })
                // Ensure arrays are arrays
                if (out.client && !Array.isArray(out.client)) out.client = Array.isArray(out.client) ? out.client : [out.client]
                if (out.professional && !Array.isArray(out.professional)) out.professional = Array.isArray(out.professional) ? out.professional : [out.professional]
                return out
            }

            if (event?.id) {
                // Update via secure RPC to avoid RLS/profile permission issues
                const payload = sanitize(data)
                const { error: updateErr } = await supabase.rpc('update_event_json', { p_payload: { id: event.id, changes: payload } })
                if (updateErr) throw updateErr
            } else {
                // Create directly using Supabase client (only allowed fields + company)
                const dataWithCompany = sanitize({ ...data, company: companyId })

                const { error: insertErr } = await supabase.from('events').insert(dataWithCompany).select('id').maybeSingle()
                if (insertErr) throw insertErr
            }

            onSave()
            onOpenChange(false)
        } catch (err) {
            logError('Error al guardar evento:', err)
            alert('Error al guardar el evento')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!event?.id) return

        try {
            setLoading(true)
            // Delete via server endpoint which will refund credits if needed
            // Delete directly using Supabase client
const { error: delErr } = await supabase.rpc('delete_event_json', { p_payload: { id: event.id } })
            if (delErr) throw delErr

            onSave()
            onOpenChange(false)
            setShowDeleteDialog(false)
        } catch (err: any) {
            logError('Error al eliminar evento:', err)
            alert(`Error al eliminar el evento: ${err?.message || 'Error desconocido'}`)
        } finally {
            setLoading(false)
        }
    }

    // Cliente: Apuntarme / Borrarme handlers
    const isSignedUp = !!(user && selectedClients.includes(user.id))

    // Tiempo (minutos) hasta el inicio del evento según la fecha/hora del formulario
    const minutesUntilStart = useMemo(() => {
        if (!fecha) return Infinity
        const dt = new Date(fecha)
        dt.setHours(parseInt(hora || '0'), parseInt(minutos || '0'), 0, 0)
        return Math.round((dt.getTime() - Date.now()) / (1000 * 60))
    }, [fecha, hora, minutos])

    const classUnenrollMins = company?.class_unenroll_mins ?? 0
    const classBlockMins = company?.class_block_mins ?? 0

    const signDisabledByTime = (selectedClients.length === 0) && (minutesUntilStart < classBlockMins)
    const unsignDisabledByTime = minutesUntilStart < classUnenrollMins

    // Tooltip texts for disabled buttons (clients)
    const signDisabledByCredits = isClientView && (clientCredits ?? 0) <= 0
    let signTooltip: string | null = null
    if (isSignedUp) {
        signTooltip = 'Ya estás apuntado'
    } else if (signDisabledByTime) {
        signTooltip = 'Clase cerrada'
    } else if (signDisabledByCredits) {
        signTooltip = 'Créditos insuficientes'
    }
    const unsignTooltip = !isSignedUp ? 'No estás apuntado' : (unsignDisabledByTime ? 'La clase está a punto de empezar' : null)

    // Determine if the event datetime has already passed (for existing events)
    const eventHasPassed = event?.datetime ? (new Date(event.datetime).getTime() < Date.now()) : false

    // Hide footer for clients when viewing appointments, or when viewing a class that already took place
    const hideFooterForClient = isClientView && (formData.type === 'appointment' || (formData.type === 'class' && eventHasPassed))

    const handleSignUp = async () => {
        if (!user?.id) return

        // Block if client has insufficient credits
        if (isClientView && (clientCredits ?? 0) <= 0) {
            alert('Créditos insuficientes')
            return
        }

        // If no event yet (creating new), just add locally
        if (!event?.id) {
            if (!selectedClients.includes(user.id)) {
                setSelectedClients(prev => [...prev, user.id])
            }
            return
        }

        try {
            setLoading(true)

            const newClients = selectedClients.includes(user.id) ? selectedClients : [...selectedClients, user.id]

            // Persist signup via secure RPC (server will validate credits and timings)
            const { error: updErr } = await supabase.rpc('update_event_json', { p_payload: { id: event.id, changes: { client: newClients } } })
            if (updErr) throw updErr

            // Update local state and notify parent
            setSelectedClients(newClients)
            onSave()
        } catch (err: any) {
            logError('Error apuntando al cliente al evento:', err)

            alert('Error al apuntarme al evento')
        } finally {
            setLoading(false)
        }
    }

    const handleUnsign = async () => {
        if (!user?.id) return

        // If no event yet (creating new), just remove locally
        if (!event?.id) {
            setSelectedClients(prev => prev.filter(id => id !== user.id))
            return
        }

        try {
            setLoading(true)

            const newClients = selectedClients.filter(id => id !== user.id)

            // Persist unsign via secure RPC (server will validate timing rules)
            const { error: updErr } = await supabase.rpc('update_event_json', { p_payload: { id: event.id, changes: { client: newClients } } })
            if (updErr) throw updErr

            // Update local state and notify parent
            setSelectedClients(newClients)
            onSave()
        } catch (err: any) {
            logError('Error borrando cliente del evento:', err)

            alert('Error al borrarme del evento')
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
                } else if (value === 'vacation') {
                    // Vacaciones no deben tener clientes asociados
                    newData.client = []
                }
            }

            return newData
        })

        // Limpia selectedClients si el tipo cambia a vacaciones
        if (field === 'type' && value === 'vacation') {
            setSelectedClients([])
        }
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
                        <div className="space-y-3">


                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Tipo</Label>
                                    <Select
                                        value={formData.type ?? 'appointment'}
                                        onValueChange={(value) => { if (isClientView) return; handleChange('type', value as Event['type']) }}
                                    >
                                        <SelectTrigger tabIndex={isClientView ? -1 : undefined} className={isClientView ? 'pointer-events-none opacity-90 [&>svg]:hidden' : ''}>
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
                                                <Label htmlFor="dias">Días</Label>
                                                <Input
                                                    id="dias"
                                                    type="number"
                                                    min="0"
                                                    value={dias}
                                                    onChange={(e) => setDias(parseInt(e.target.value) || 0)}
                                                    required
                                                    readOnly={isClientView}
                                                    tabIndex={isClientView ? -1 : undefined}
                                                    onMouseDown={(e) => { if (isClientView) e.preventDefault() }}
                                                    onFocus={(e) => { if (isClientView) (e.target as HTMLInputElement).blur() }}
                                                    className={isClientView ? 'opacity-90' : ''}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="horas-vac">Horas</Label>
                                                <Input
                                                    id="horas-vac"
                                                    type="number"
                                                    min="0"
                                                    max="23"
                                                    value={horasVacaciones}
                                                    onChange={(e) => setHorasVacaciones(parseInt(e.target.value) || 0)}
                                                    required
                                                    readOnly={isClientView}
                                                    tabIndex={isClientView ? -1 : undefined}
                                                    onMouseDown={(e) => { if (isClientView) e.preventDefault() }}
                                                    onFocus={(e) => { if (isClientView) (e.target as HTMLInputElement).blur() }}
                                                    className={isClientView ? 'opacity-90' : ''}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Label htmlFor="duration">Duración (min)</Label>
                                            <Input
                                                id="duration"
                                                type="number"
                                                min="1"
                                                value={formData.duration ?? 60}
                                                onChange={(e) => { if (isClientView) return; handleChange('duration', parseInt(e.target.value)) }}
                                                required
                                                readOnly={isClientView}
                                                tabIndex={isClientView ? -1 : undefined}
                                                onMouseDown={(e) => { if (isClientView) e.preventDefault() }}
                                                onFocus={(e) => { if (isClientView) (e.target as HTMLInputElement).blur() }}
                                                className={isClientView ? 'opacity-90' : ''}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                tabIndex={isClientView ? -1 : undefined}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !fecha && "text-muted-foreground",
                                                    isClientView && 'pointer-events-none opacity-90'
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
                                    <Label htmlFor="hora">Hora</Label>
                                    <div className="flex gap-2">
                                        {isClientView ? (
                                            <Input
                                                readOnly
                                                tabIndex={-1}
                                                className="flex-1"
                                                value={`${hora}:${minutos}`}
                                                onMouseDown={(e) => { e.preventDefault() }}
                                                onFocus={(e) => { (e.target as HTMLInputElement).blur() }}
                                            />
                                        ) : (
                                            <>
                                                <Select value={hora} onValueChange={(v) => setHora(v)}>
                                                    <SelectTrigger tabIndex={isClientView ? -1 : undefined} className="flex-1">
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
                                                <Select value={minutos} onValueChange={(v) => setMinutos(v)}>
                                                    <SelectTrigger tabIndex={isClientView ? -1 : undefined} className="flex-1">
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
                                            </>
                                        )}
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
                                    <div className="flex flex-wrap gap-2">
                                        {selectedClients.map((clientId) => {
                                            const card = profilesMap[clientId]

                                            if (card) {
                                                return (
                                                    <div key={clientId} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm">
                                                        {card.photo ? (
                                                            <img src={card.photo} alt={`${card.name} ${card.last_name}`} className="h-6 w-6 rounded object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                                                {String(card.name || '')?.charAt(0)}{String(card.last_name || '')?.charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="truncate">{card.name} {card.last_name}</span>
                                                        {!isClientView && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedClients(prev => prev.filter(id => id !== clientId))}
                                                                className="hover:text-destructive ml-2"
                                                                aria-label={`Eliminar ${card.name} ${card.last_name}`}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            }

                                            if (profilesLoading) {
                                                return (
                                                    <div key={clientId} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm animate-pulse">
                                                        <div className="h-6 w-6 rounded bg-muted-foreground/20" />
                                                        <div className="flex-1 h-4 bg-muted-foreground/20 rounded" />
                                                    </div>
                                                )
                                            }

                                            // Try to find cliente from preloaded `clientes` to avoid flicker
                                            const cliente = clientes.find(c => c.user === clientId)
                                            if (cliente) {
                                                const photoUrl = cliente.photoUrl || (cliente.photo_path ? getFilePublicUrl('profile_photos', cliente.id, cliente.photo_path) : null)
                                                return (
                                                    <div key={clientId} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm">
                                                        {photoUrl ? (
                                                            <img
                                                                src={photoUrl}
                                                                alt={`${cliente.name} ${cliente.last_name}`}
                                                                className="h-6 w-6 rounded object-cover flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                                                {String(cliente.name || '')?.charAt(0)}{String(cliente.last_name || '')?.charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="truncate">{cliente.name} {cliente.last_name}</span>
                                                        {!isClientView && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedClients(prev => prev.filter(id => id !== clientId))}
                                                                className="hover:text-destructive ml-2"
                                                                aria-label={`Eliminar ${cliente.name} ${cliente.last_name}`}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            }

                                            // If still not found, show nothing (we removed the 'Tarjeta no encontrada' UI)
                                            return null
                                        })}
                                    </div>
                                    {!isClientView && (
                                        <div className="space-y-2">
                                            <Input
                                                placeholder="Buscar cliente..."
                                                value={clientSearch}
                                                onChange={(e) => setClientSearch(e.target.value)}
                                                className="text-sm"
                                                ref={(el: HTMLInputElement) => clientSearchRef.current = el}
                                            />
                                            {clientSearch && (
                                                <div className="border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 absolute z-50 bg-background">
                                                    {clientes
                                                        .filter(cliente => {
                                                            const normalizedSearch = clientSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                                                            const normalizedClientName = (cliente.name + ' ' + cliente.last_name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                                                            return normalizedClientName.includes(normalizedSearch)
                                                        })
                                                        .filter(cliente => !selectedClients.includes(cliente.user))
                                                        .map((cliente) => {
                                                            const photoUrl = cliente.photo ? cliente.photo : null
                                                            return (
                                                                <button
                                                                    key={cliente.user}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (isClientView) return
                                                                        // Validar límite de asistentes para clases
                                                                        if (formData.type === 'class' && company?.max_class_assistants && selectedClients.length >= company.max_class_assistants) {
                                                                            setShowMaxAssistantsDialog(true)
                                                                            return
                                                                        }
                                                                        setSelectedClients(prev => [...prev, cliente.user])
                                                                        setClientSearch('')
                                                                    }}
                                                                    className={isClientView ? "w-full text-left px-2 py-1.5 rounded text-sm opacity-80" : "w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm block flex items-center gap-2"}
                                                                >
                                                                    {photoUrl ? (
                                                                        <img
                                                                            src={photoUrl}
                                                                            alt={`${cliente.name} ${cliente.last_name}`}
                                                                            className="h-8 w-8 rounded object-cover flex-shrink-0"
                                                                        />
                                                                    ) : (
                                                                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                                                            {String(cliente.name || '')?.charAt(0)}{String(cliente.last_name || '')?.charAt(0)}
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
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>{formData.type === 'vacation' ? 'Profesionales' : 'Profesional'}</Label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedProfessionals.map((profId) => {
                                        const prof = profesionales.find(p => p.user === profId)
                                        return prof ? (
                                            <div key={profId} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm">
                                                {prof.photo ? (
                                                    <img src={prof.photo} alt={`${prof.name} ${prof.last_name}`} className="h-6 w-6 rounded object-cover flex-shrink-0" />
                                                ) : (
                                                    <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                                        {String(prof.name || '')?.charAt(0)}{String(prof.last_name || '')?.charAt(0)}
                                                    </div>
                                                )}
                                                <span className="truncate">{prof.name} {prof.last_name}</span>
                                                {!isClientView && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedProfessionals(prev => prev.filter(id => id !== profId))}
                                                        className="hover:text-destructive ml-2"
                                                        aria-label={`Eliminar ${prof.name} ${prof.last_name}`}
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ) : null
                                    })}
                                </div>
                                {!isClientView && (
                                    <Select
                                        value=""
                                        onValueChange={(value) => {
                                            if (isClientView) return
                                            if (value && !selectedProfessionals.includes(value)) {
                                                setSelectedProfessionals(prev => [...prev, value])
                                            }
                                        }}
                                    >
                                        <SelectTrigger tabIndex={isClientView ? -1 : undefined} className={isClientView ? 'pointer-events-none opacity-90' : ''}>
                                            <SelectValue placeholder="Añadir profesional" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {profesionales.map((prof) => (
                                                <SelectItem key={prof.user} value={prof.user}>
                                                    <div className="flex items-center gap-2">
                                                        {prof.photo ? (
                                                            <img src={prof.photo} alt={`${prof.name} ${prof.last_name}`} className="h-6 w-6 rounded object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                                                {prof.name?.charAt(0)}{prof.last_name?.charAt(0)}
                                                            </div>
                                                        )}
                                                        <span>{prof.name} {prof.last_name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {formData.type === 'appointment' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        {!isClientView && (
                                            <div className="space-y-2">
                                                <Label htmlFor="cost">Coste (€)</Label>
                                                <Input
                                                    id="cost"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={formData.cost ?? 0}
                                                    onChange={(e) => { if (isClientView) return; handleChange('cost', parseFloat(e.target.value)) }}
                                                    required
                                                    readOnly={isClientView}
                                                    tabIndex={isClientView ? -1 : undefined}
                                                    onMouseDown={(e) => { if (isClientView) e.preventDefault() }}
                                                    onFocus={(e) => { if (isClientView) (e.target as HTMLInputElement).blur() }}
                                                    className={isClientView ? 'opacity-90' : ''}
                                                />
                                            </div>
                                        )}

                                        {!isClientView && (
                                            <div className="space-y-2">
                                                <Label>Pagado</Label>
                                                <div className="flex items-center h-10">
                                                    <Checkbox
                                                        id="paid"
                                                        checked={formData.paid ?? false}
                                                        onCheckedChange={(checked) => { if (isClientView) return; handleChange('paid', Boolean(checked)) }}
                                                        tabIndex={isClientView ? -1 : undefined}
                                                    />
                                                    <label
                                                        htmlFor="paid"
                                                        className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                    >
                                                        Sí
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <Label>Notas</Label>
                                <RichTextEditor
                                    value={formData.notes || ""}
                                    onChange={(value) => { if (isClientView) return; handleChange('notes', value) }}
                                    placeholder=""
                                    readOnly={isClientView}
                                />
                            </div>
                        </div>
                    </form>

                    {!hideFooterForClient && (
                        isClientView && formData.type === 'class' ? (
                            <DialogFooter className="mt-4">
                                <div className="flex w-full justify-between">
                                    <div>
                                        {unsignTooltip ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="inline-block">
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                onClick={handleUnsign}
                                                                disabled={loading || !isSignedUp || unsignDisabledByTime}
                                                            >
                                                                Borrarme
                                                            </Button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                                                        {unsignTooltip}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                onClick={handleUnsign}
                                                disabled={loading || !isSignedUp || unsignDisabledByTime}
                                            >
                                                Borrarme
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                            Cancelar
                                        </Button>
                                        {signTooltip ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="inline-block">
                                                            <Button type="button" onClick={handleSignUp} disabled={loading || isSignedUp || signDisabledByTime || signDisabledByCredits}>
                                                                {loading ? "Procesando..." : (isSignedUp ? "Apuntado" : "Apuntarme")}
                                                            </Button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                                                        {signTooltip}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Button type="button" onClick={handleSignUp} disabled={loading || isSignedUp || signDisabledByTime || signDisabledByCredits}>
                                                {loading ? "Procesando..." : (isSignedUp ? "Apuntado" : "Apuntarme")}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </DialogFooter>
                        ) : (
                            <DialogFooter className="mt-4">
                                <div className="flex w-full justify-between">
                                    <div>
                                        {event?.id && !isClientView && (
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
                                        <Button type="submit" form="event-form" disabled={loading || isClientView}>
                                            {loading ? "Guardando..." : "Guardar"}
                                        </Button>
                                    </div>
                                </div>
                            </DialogFooter>
                        )
                    )}
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
                    <Alert className="border-destructive/50 text-destructive [&>svg]:top-3.5 [&>svg+div]:translate-y-0 bg-[hsl(var(--background))]">
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
