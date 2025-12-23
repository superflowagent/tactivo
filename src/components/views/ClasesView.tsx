import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Dumbbell, Plus, Pencil, Trash, CalendarRange, CheckCircle } from "lucide-react"
import pb from '@/lib/pocketbase'
import { useAuth } from '@/contexts/AuthContext'
import type { Event } from '@/types/event'
import { ClassSlotDialog } from '@/components/clases/ClassSlotDialog'
import { PropagateDialog } from '@/components/clases/PropagateDialog'

const WEEKDAYS = [
    { name: 'Lunes', value: 1 },
    { name: 'Martes', value: 2 },
    { name: 'Miércoles', value: 3 },
    { name: 'Jueves', value: 4 },
    { name: 'Viernes', value: 5 },
]

export function ClasesView() {
    const { companyId } = useAuth()
    const [templateSlots, setTemplateSlots] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [slotToDelete, setSlotToDelete] = useState<Event | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<Event | null>(null)
    const [selectedDay, setSelectedDay] = useState<number>(1)
    const [propagateDialogOpen, setPropagateDialogOpen] = useState(false)
    const [showSuccessAlert, setShowSuccessAlert] = useState(false)
    const [draggedSlot, setDraggedSlot] = useState<Event | null>(null)
    const [dragOverDay, setDragOverDay] = useState<number | null>(null)

    useEffect(() => {
        loadTemplateSlots()
    }, [companyId])

    const loadTemplateSlots = async () => {
        if (!companyId) return

        try {
            setLoading(true)
            const records = await pb.collection('classes_template').getFullList<Event>({
                filter: `company = "${companyId}"`,
                sort: 'datetime',
                expand: 'client,professional',
            })
            setTemplateSlots(records)
        } catch (error) {
            console.error('Error cargando slots:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = (slot: Event) => {
        setSlotToDelete(slot)
        setDeleteDialogOpen(true)
    }

    const handleEdit = (slot: Event) => {
        setSelectedSlot(slot)
        setSelectedDay(getDayOfWeek(slot.datetime))
        setDialogOpen(true)
    }

    const handleCreate = (dayValue: number) => {
        setSelectedSlot(null)
        setSelectedDay(dayValue)
        setDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!slotToDelete?.id) return

        try {
            await pb.collection('classes_template').delete(slotToDelete.id)
            await loadTemplateSlots()
            setDeleteDialogOpen(false)
            setSlotToDelete(null)
        } catch (error) {
            console.error('Error eliminando slot:', error)
            alert('Error al eliminar la clase')
        }
    }

    const getDayOfWeek = (datetime: string) => {
        const date = new Date(datetime)
        return date.getDay() // 0=Sunday, 1=Monday, etc.
    }

    const getTime = (datetime: string) => {
        const date = new Date(datetime)
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }

    const getProfessionalNames = (slot: any) => {
        if (!slot.expand?.professional) return '-'
        if (Array.isArray(slot.expand.professional)) {
            return slot.expand.professional.map((p: any) => `${p.name} ${p.last_name}`).join(', ')
        }
        return `${slot.expand.professional.name} ${slot.expand.professional.last_name}`
    }

    const getClientCount = (slot: Event) => {
        if (!slot.client) return 0
        return Array.isArray(slot.client) ? slot.client.length : 1
    }

    const getSlotsByDay = (dayValue: number) => {
        return templateSlots
            .filter(slot => getDayOfWeek(slot.datetime) === dayValue)
            .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    }

    const handleDragStart = (e: React.DragEvent, slot: Event) => {
        setDraggedSlot(slot)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent, dayValue: number) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverDay(dayValue)
    }

    const handleDragLeave = () => {
        setDragOverDay(null)
        // Don't reset cursor here, wait for drop
    }

    const handleDrop = async (e: React.DragEvent, targetDay: number) => {
        e.preventDefault()
        setDragOverDay(null)

        if (!draggedSlot || !draggedSlot.id) {
            setDraggedSlot(null)
            return
        }

        const currentDay = getDayOfWeek(draggedSlot.datetime)
        if (currentDay === targetDay) {
            setDraggedSlot(null)
            return
        }

        try {
            // Calcular nueva fecha manteniendo la hora
            const currentDate = new Date(draggedSlot.datetime)
            const currentDayOfWeek = currentDate.getDay()
            const diff = targetDay - currentDayOfWeek
            const newDate = new Date(currentDate)
            newDate.setDate(currentDate.getDate() + diff)

            // Actualizar el slot en la base de datos
            await pb.collection('classes_template').update(draggedSlot.id, {
                datetime: newDate.toISOString()
            })

            // Recargar los slots
            await loadTemplateSlots()
        } catch (error) {
            console.error('Error moviendo clase:', error)
            alert('Error al mover la clase')
        } finally {
            setDraggedSlot(null)
        }
    }

    return (
        <div className="flex flex-1 flex-col gap-4">
            <div className="flex justify-end">
                <Button onClick={() => setPropagateDialogOpen(true)} style={{
                    backgroundColor: 'hsl(var(--class-color))',
                    color: 'white'
                }} className="hover:opacity-90 transition-opacity">
                    <CalendarRange className="mr-2 h-4 w-4" />
                    Propagar
                </Button>
            </div>
            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <p className="text-center text-muted-foreground py-8">Cargando...</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {WEEKDAYS.map((day) => {
                                const daySlots = getSlotsByDay(day.value)
                                return (
                                    <Card
                                        key={day.value}
                                        className={`border-2 transition-all ${dragOverDay === day.value ? 'bg-primary/10 ring-2 ring-primary shadow-lg' : ''}`}
                                        onDragOver={(e) => handleDragOver(e, day.value)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, day.value)}
                                    >
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-semibold flex items-center justify-between">
                                                {day.name}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => handleCreate(day.value)}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {daySlots.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                    Sin clases
                                                </p>
                                            ) : (
                                                daySlots.map((slot) => (
                                                    <Card
                                                        key={slot.id}
                                                        data-slot-id={slot.id}
                                                        className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, slot)}
                                                    >
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <p className="font-semibold">{getTime(slot.datetime)}</p>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 hover:bg-slate-200"
                                                                        onClick={() => handleEdit(slot)}
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 hover:bg-slate-200"
                                                                        onClick={() => handleDelete(slot)}
                                                                    >
                                                                        <Trash className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground space-y-1">
                                                                <p>⏱️ {slot.duration} min</p>
                                                                <p>👤 {getProfessionalNames(slot)}</p>
                                                                <p>👥 {getClientCount(slot)} clientes</p>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar clase?</AlertDialogTitle>
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

            <ClassSlotDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                slot={selectedSlot}
                dayOfWeek={selectedDay}
                onSave={loadTemplateSlots}
            />
            <PropagateDialog
                open={propagateDialogOpen}
                onOpenChange={setPropagateDialogOpen}
                templateSlots={templateSlots}
                companyId={companyId || ''}
                onSuccess={() => {
                    setShowSuccessAlert(true)
                    setTimeout(() => setShowSuccessAlert(false), 5000)
                }}
            />

            {showSuccessAlert && (
                <div className="fixed bottom-4 right-4 z-50 w-96">
                    <Alert className="border-green-500 bg-green-50 [&>svg]:top-3.5 [&>svg+div]:translate-y-0">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription>
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-green-800">Clases propagadas correctamente</p>
                                </div>
                                <button
                                    onClick={() => setShowSuccessAlert(false)}
                                    className="text-green-600 hover:text-green-800"
                                >
                                    ×
                                </button>
                            </div>
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    )
}
