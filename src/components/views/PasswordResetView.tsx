import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext'

// Cleanup: simplify password reset handler and remove unused variables
export function PasswordResetView() {
    const { token: paramToken } = useParams<{ token?: string }>();
    const navigate = useNavigate();
    const [token, setToken] = useState<string | null>(paramToken ?? null);
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const { logout } = useAuth();

    useEffect(() => {
        if (!token) {
            const hash = window.location.hash || "";
            // handle links like /_/#/auth/password-reset/{TOKEN}
            const m = hash.match(/\/auth\/password-reset\/([^\/?#]+)/);
            if (m) setToken(m[1]);
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!token) {
            setError("Token no encontrado");
            return;
        }
        if (password !== passwordConfirm) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        setLoading(true);
        try {
            // Supabase: ensure session available then update password
            const sessionRes = await supabase.auth.getSession()
            if (!sessionRes.data.session) {
                setError('El enlace de restablecimiento debe abrirse desde el correo (el token debe incluirse en la sesión de Supabase).')
                setLoading(false)
                return
            }

            const { error: updateErr } = await supabase.auth.updateUser({ password })
            if (updateErr) throw updateErr

            // Clear any existing session so the app does not auto-redirect to the panel
            try { await logout() } catch {
                // ignore logout errors
            }

            setSuccess(true);
            setTimeout(() => navigate("/"), 1800);
        } catch (err: any) {
            setError(err?.message || 'Error restableciendo contraseña')
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-6">
            <Card className="w-full max-w-md mx-4">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Bienvenido a Tactivo</CardTitle>
                    <CardDescription className="text-center">Restablecer contraseña</CardDescription>
                </CardHeader>

                <CardContent>
                    {success ? (
                        <div className="bg-green-50 border border-green-200 p-4 rounded">
                            <p className="font-medium">Contraseña restablecida correctamente.</p>
                            <p className="text-sm">Serás redirigido al login en breve.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Nueva contraseña</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="passwordConfirm">Confirmar contraseña</Label>
                                <Input
                                    id="passwordConfirm"
                                    type="password"
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Procesando..." : "Restablecer contraseña"}</Button>
                        </form>
                    )}
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
    );
}

export default PasswordResetView;
