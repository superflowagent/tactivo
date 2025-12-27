import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { error as logError } from '@/lib/logger'
import { AlertCircle, CheckCircle } from 'lucide-react'
import pb from '@/lib/pocketbase'

// Cleanup: removed nested <form>, fixed unused vars and streamlined password reset inline UI
export function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Password reset inline state
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const resetInputRef = useRef<HTMLInputElement | null>(null)

  // UI state
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login, companyName } = useAuth()
  const navigate = useNavigate()



  // Usar useEffect para la navegación en lugar de hacerlo durante el render
  useEffect(() => {
    if (companyName) {
      navigate(`/${companyName}/panel`)
    }
  }, [companyName, navigate])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
      // La navegación se hará en el useEffect cuando companyName esté disponible
    } catch (err: any) {
      logError('Login error:', err)
      logError('Error status:', err.status)
      logError('Error data:', err.data)

      if (err.status === 400) {
        setError('Email o contraseña incorrecta')
      } else if (err.status === 0 || err.isAbort) {
        setError('Error de conexión. Verifica tu conexión a internet.')
      } else {
        setError(err.message || 'Error al iniciar sesión. Inténtalo de nuevo.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendReset = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setResetError('')
    if (!resetEmail) {
      setResetError('Introduce un email válido')
      return
    }
    setSendingReset(true)
    try {
      await pb.collection('users').requestPasswordReset(resetEmail)
      setResetSent(true)
      // clear input after sending — keep success message visible until user cancels
      setResetEmail('')
    } catch (err: any) {
      import('@/lib/pocketbaseErrors').then(({ formatPocketbaseError }) => {
        const msg = formatPocketbaseError(err, { field: 'reset-email' })
        setResetError(msg)
      })
    } finally {
      setSendingReset(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-6">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-left">Bienvenido a Tactivo</CardTitle>
          <CardDescription className="text-center">
            Iniciar sesión
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-3 w-full max-w-md mx-auto">
            {/* Botón en su propia línea, alineado a la derecha */}
            <div className="w-full flex justify-end">
              <div className="inline-flex justify-end min-w-[12rem]">
                <Button variant="link" type="button" className="pr-0 text-right whitespace-nowrap" onClick={() => {
                  if (resetOpen) {
                    setResetOpen(false)
                    setResetEmail('')
                    setResetError('')
                    setResetSent(false)
                  } else {
                    setResetOpen(true)
                  }
                }}>{resetOpen ? 'Cancelar' : 'Restablecer contraseña'}</Button>
              </div>
            </div>

            {/* Área del email en fila separada debajo, alineada con inputs */}
            {resetOpen && (
              <div className="mt-3 w-full">
                {resetSent ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Correo enviado</p>
                      <p className="text-sm text-muted-foreground">Revisa tu email para completar el restablecimiento.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-full">
                      <div className="space-y-2">
                        <Label htmlFor="resetEmail" className="text-left">Email</Label>
                        <div className="relative">
                          <Input
                            ref={resetInputRef}
                            id="resetEmail"
                            placeholder="tu@email.com"
                            type="email"
                            autoComplete="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendReset(); } }}
                            required
                          />
                          <button type="button" onClick={() => handleSendReset()} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-primary hover:underline" disabled={sendingReset}>{sendingReset ? 'Enviando...' : 'Enviar enlace'}</button>
                        </div>
                      </div>

                      {resetError && (
                        <div className="mt-2">
                          <Alert variant="destructive">
                            <AlertDescription>{resetError}</AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert en esquina inferior derecha */}
      {error && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto z-50 w-auto md:max-w-md animate-in slide-in-from-right">
          <Alert variant="destructive" className="border-destructive/50 [&>svg]:top-3.5 [&>svg+div]:translate-y-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
