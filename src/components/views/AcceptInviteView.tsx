import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function AcceptInviteView() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('invite_token')
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!token) {
            setMessage('Token de invitación no encontrado en la URL')
        }
    }, [token])

    const handleAccept = async () => {
        if (!token) return
        setLoading(true)
        try {
            // Ensure user is authenticated
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData?.session) {
                setMessage('Debes iniciar sesión o completar el restablecimiento de contraseña enviado por email antes de aceptar la invitación. Revisa tu correo.')
                setLoading(false)
                return
            }

            // Call RPC to link profile to current user
            const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
            if (error) {
                setMessage('Error al aceptar la invitación: ' + (error.message || String(error)))
                setLoading(false)
                return
            }

            setMessage('Invitación aceptada correctamente. Redirigiendo...')
            setTimeout(() => {
                // Redirect to root or to panel — simple redirect to /
                navigate('/')
            }, 1200)
        } catch (err: any) {
            setMessage('Error al aceptar la invitación: ' + String(err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto mt-20 p-6">
            <h1 className="text-2xl font-semibold mb-4">Aceptar invitación</h1>
            <p className="mb-4">Sigue este paso para vincular tu cuenta con la clínica que te invitó.</p>

            {message && <div className="mb-4 text-sm text-muted-foreground">{message}</div>}

            {!message && <div className="mb-4">Token: <code className="bg-muted px-2 py-1 rounded">{token}</code></div>}

            <div className="flex gap-2">
                <Button onClick={handleAccept} disabled={loading || !token}>{loading ? 'Procesando...' : 'Aceptar invitación'}</Button>
                <Button variant="outline" onClick={() => navigate('/')}>Ir a inicio</Button>
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
                Si aún no has establecido tu contraseña, revisa tu correo y utiliza el link de restablecimiento; una vez inicies sesión vuelve aquí y pulsa "Aceptar invitación".
            </div>
        </div>
    )
}