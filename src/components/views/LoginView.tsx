import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { error as logError } from '@/lib/logger'
import { AlertCircle } from 'lucide-react'

export function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
      // La navegación se hará en el useEffect cuando companyName esté disponible
    } catch (err: any) {
      logError('Login error:', err)
      logError('Error status:', err.status)
      logError('Error data:', err.data)

      if (err.message === 'Solo los profesionales pueden acceder al panel') {
        setError(err.message)
      } else if (err.status === 400) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-6">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Bienvenido a Tactivo</CardTitle>
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
