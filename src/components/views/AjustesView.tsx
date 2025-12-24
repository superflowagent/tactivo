import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Building2, Save, CheckCircle2, HelpCircle } from "lucide-react"
import pb from "@/lib/pocketbase"
import { error as logError } from '@/lib/logger'
import { useAuth } from "@/contexts/AuthContext"
import type { Company } from "@/types/company"

export function AjustesView() {
  const { companyId } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [formData, setFormData] = useState<Partial<Company>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (companyId) {
      loadCompany()
    }
  }, [companyId])

  const loadCompany = async () => {
    if (!companyId) return

    try {
      setLoading(true)
      setError(null)
      const record = await pb.collection('companies').getOne<Company>(companyId)
      setCompany(record)
      setFormData(record)

      // Cargar preview del logo existente
      if (record.logo) {
        setLogoPreview(pb.files.getURL(record, record.logo))
      }
    } catch (err: any) {
      logError('Error al cargar configuración:', err)
      setError('Error al cargar la configuración de la empresa')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof Company, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      // Crear preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const formDataToSend = new FormData()

      // Añadir campos regulares
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'logo' && key !== 'id' && key !== 'created' && key !== 'updated') {
          formDataToSend.append(key, String(value))
        }
      })

      // Añadir logo si hay uno nuevo
      if (logoFile) {
        formDataToSend.append('logo', logoFile)
      } else if (!logoPreview && formData.logo) {
        // Si no hay preview y antes había logo, borrarlo
        formDataToSend.append('logo', '')
      }

      await pb.collection('companies').update(companyId, formDataToSend)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

      // Recargar datos
      await loadCompany()
    } catch (err: any) {
      logError('Error al guardar configuración:', err)
      setError('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Cargando configuración...</p>
      </div>
    )
  }

  if (error && !company) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Ajustes del centro</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert className="border-destructive/50 text-destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Logo del Centro */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="logo">Logo</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <label
                      htmlFor="logo"
                      className="flex items-center justify-between h-10 px-3 py-2 text-sm rounded-md border border-border bg-background cursor-pointer hover:bg-muted hover:text-foreground"
                    >
                      <span>
                        {logoFile ? logoFile.name : "Elegir archivo"}
                      </span>
                      {(logoFile || logoPreview) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setLogoFile(null)
                            setLogoPreview(null)
                            setFormData(prev => ({ ...prev, logo: '' }))
                            const input = document.getElementById('logo') as HTMLInputElement
                            if (input) input.value = ''
                          }}
                          className="ml-2 text-foreground hover:text-destructive text-lg font-semibold"
                        >
                          ×
                        </button>
                      )}
                    </label>
                  </div>
                  {logoPreview && (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                      <img
                        src={logoPreview}
                        alt="Preview"
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Primera línea: Nombre, Hora Apertura, Hora Cierre */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Centro</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="open_time">Hora de Apertura</Label>
                <Input
                  id="open_time"
                  type="time"
                  value={formData.open_time || ''}
                  onChange={(e) => handleChange('open_time', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="close_time">Hora de Cierre</Label>
                <Input
                  id="close_time"
                  type="time"
                  value={formData.close_time || ''}
                  onChange={(e) => handleChange('close_time', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Segunda línea: Asistentes, Bloqueo, Borrado con tooltips */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="max_class_assistants">Número de Asistentes</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Máximo de asistentes por clase</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="max_class_assistants"
                  type="number"
                  min="1"
                  value={formData.max_class_assistants || ''}
                  onChange={(e) => handleChange('max_class_assistants', parseInt(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="class_block_mins">Bloqueo de Clase</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minutos antes de la clase para bloquear reserva</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="class_block_mins"
                  type="number"
                  min="0"
                  value={formData.class_block_mins || ''}
                  onChange={(e) => handleChange('class_block_mins', parseInt(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="class_unenroll_mins">Borrado de Clase</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Horas antes de la clase para permitir cancelación</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="class_unenroll_mins"
                  type="number"
                  min="0"
                  value={formData.class_unenroll_mins ? formData.class_unenroll_mins / 60 : ''}
                  onChange={(e) => handleChange('class_unenroll_mins', parseInt(e.target.value) * 60)}
                  required
                />
              </div>
            </div>

            {/* Duraciones */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default_appointment_duration">Duración Citas (minutos)</Label>
                <Input
                  id="default_appointment_duration"
                  type="number"
                  min="1"
                  value={formData.default_appointment_duration || ''}
                  onChange={(e) => handleChange('default_appointment_duration', parseInt(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_class_duration">Duración Clases (minutos)</Label>
                <Input
                  id="default_class_duration"
                  type="number"
                  min="1"
                  value={formData.default_class_duration || ''}
                  onChange={(e) => handleChange('default_class_duration', parseInt(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="submit" disabled={saving}>
                <Save className="mr-0 h-4 w-4" />
                Guardar Ajustes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Alert de éxito en esquina inferior derecha */}
      {success && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto z-50 w-auto md:max-w-md animate-in slide-in-from-right">
          <Alert className="bg-green-50 border-green-200 [&>svg]:top-3.5 [&>svg+div]:translate-y-0">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">
              Ajustes guardados correctamente
            </AlertTitle>
          </Alert>
        </div>
      )}
    </div>
  )
}
