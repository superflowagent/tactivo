import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import pb from "@/lib/pocketbase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PasswordResetView() {
  const { token: paramToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(paramToken ?? null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await pb.collection("users").confirmPasswordReset(token, password, passwordConfirm);
      setSuccess(true);
      setTimeout(() => navigate("/"), 1800);
    } catch (err: any) {
      // pocketbase may return structured error
      const msg = err?.response?.data?.message || err?.message || "Error al restablecer contraseña";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Restablecer contraseña</h2>

        {error && (
          <div className="mb-4">
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {success ? (
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <p className="font-medium">Contraseña restablecida correctamente.</p>
            <p className="text-sm">Serás redirigido al login en breve.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="passwordConfirm">Confirmar contraseña</Label>
              <Input id="passwordConfirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <Button type="submit" disabled={loading}>{loading ? "Procesando..." : "Cambiar contraseña"}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default PasswordResetView;
