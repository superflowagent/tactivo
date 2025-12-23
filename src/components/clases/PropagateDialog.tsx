import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { CalendarRange } from "lucide-react"
import pb from "@/lib/pocketbase"
import type { Event } from "@/types/event"

interface PropagateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    templateSlots: Event[]
    companyId: string
    onSuccess: () => void
}

export function PropagateDialog({ open, onOpenChange, templateSlots, companyId, onSuccess }: PropagateDialogProps) {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    // Calculate next month
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear

    const [selectedMonth, setSelectedMonth] = useState<string>(nextMonth.toString())
    const [selectedYear, setSelectedYear] = useState<string>(nextYear.toString())
    const [loading, setLoading] = useState(false)

    const months = [
        { value: "1", label: "Enero" },
        { value: "2", label: "Febrero" },
        { value: "3", label: "Marzo" },
        { value: "4", label: "Abril" },
        { value: "5", label: "Mayo" },
        { value: "6", label: "Junio" },
        { value: "7", label: "Julio" },
        { value: "8", label: "Agosto" },
        { value: "9", label: "Septiembre" },
        { value: "10", label: "Octubre" },
        { value: "11", label: "Noviembre" },
        { value: "12", label: "Diciembre" },
    ]

    const years = Array.from({ length: 3 }, (_, i) => currentYear + i)

    const isMonthDisabled = (monthValue: string) => {
        const month = parseInt(monthValue)
        const year = parseInt(selectedYear)
        return year === currentYear && month < currentMonth
    }

    const handlePropagate = async () => {
        if (!selectedMonth || !selectedYear) return

        setLoading(true)
        try {
            const month = parseInt(selectedMonth)
            const year = parseInt(selectedYear)
            let eventsCreated = 0

            // Para cada slot del template
            for (const slot of templateSlots) {
                const templateDate = new Date(slot.datetime)
                const templateDayOfWeek = templateDate.getDay() // 0=Sunday, 1=Monday, etc.
                const templateHours = templateDate.getHours()
                const templateMinutes = templateDate.getMinutes()

                // Encontrar todos los días del mes que coincidan con el día de la semana
                const daysInMonth = new Date(year, month, 0).getDate()

                for (let day = 1; day <= daysInMonth; day++) {
                    const currentDate = new Date(year, month - 1, day)

                    // Si el día de la semana coincide con el del template
                    if (currentDate.getDay() === templateDayOfWeek) {
                        currentDate.setHours(templateHours, templateMinutes, 0, 0)

                        // Crear el evento
                        const eventData = {
                            type: 'class',
                            datetime: currentDate.toISOString(),
                            duration: slot.duration,
                            client: slot.client || [],
                            professional: slot.professional || [],
                            company: companyId,
                            notes: slot.notes || '',
                        }

                        await pb.collection('events').create(eventData)
                        eventsCreated++
                    }
                }
            }

            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error('Error al propagar clases:', error)
            alert('Error al propagar las clases')
        } finally {
            setLoading(false)
        }
    }

    const getPreviewInfo = () => {
        if (!selectedMonth || !selectedYear) return null

        const month = parseInt(selectedMonth)
        const year = parseInt(selectedYear)
        const daysInMonth = new Date(year, month, 0).getDate()
        let totalEvents = 0

        // Contar cuántos eventos se crearían
        for (const slot of templateSlots) {
            const templateDate = new Date(slot.datetime)
            const templateDayOfWeek = templateDate.getDay()

            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, month - 1, day)
                if (currentDate.getDay() === templateDayOfWeek) {
                    totalEvents++
                }
            }
        }

        return {
            totalEvents,
            monthName: months.find(m => m.value === selectedMonth)?.label,
        }
    }

    const preview = getPreviewInfo()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarRange className="h-5 w-5" />
                        Propagar Plantilla de Clases
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona el mes al que deseas propagar las clases de la plantilla.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="month">Mes</Label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger id="month">
                                    <SelectValue placeholder="Seleccionar mes" />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((month) => (
                                        <SelectItem
                                            key={month.value}
                                            value={month.value}
                                            disabled={isMonthDisabled(month.value)}
                                        >
                                            {month.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="year">Año</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger id="year">
                                    <SelectValue placeholder="Seleccionar año" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((year) => (
                                        <SelectItem key={year} value={year.toString()}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {preview && (
                        <div className="bg-muted p-4 rounded-lg">
                            <p className="text-sm font-medium">
                                Se crearán <span className="font-bold text-primary">{preview.totalEvents}</span> clases en {preview.monthName} de {selectedYear}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handlePropagate}
                        disabled={loading || !preview || preview.totalEvents === 0}
                    >
                        {loading ? "Propagando..." : "Propagar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
