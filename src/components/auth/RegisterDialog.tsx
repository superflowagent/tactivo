import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InviteToast from '@/components/InviteToast';
import registerUser from '../../lib/registerUser';
import { error as logError } from '@/lib/logger';

export default function RegisterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [centro, setCentro] = useState('');
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [movil, setMovil] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);
    if (!email || !centro || !name || !lastName) {
      setErrorMsg('Completa los campos obligatorios');
      return;
    }
    setLoading(true);
    try {
      const res = await registerUser({ email, centro, name, last_name: lastName, movil });
      if (!res.ok) {
        const err =
          (res.json as any)?.error || (res.json as any)?.message || 'Error en el registro';
        setErrorMsg(String(err));
        return;
      }

      // Success: show toast and close dialog; navigate when toast is dismissed via onClose
      setShowToast(true);
      onOpenChange(false);
    } catch (err: any) {
      logError('Register failed', err);
      setErrorMsg(err?.message || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" hideClose>
          <DialogHeader>
            <DialogTitle>Registrarme</DialogTitle>
            <DialogDescription>Crear tu centro</DialogDescription>
          </DialogHeader>

          <form id="registerForm" onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="r_email">Email</Label>
              <Input
                id="r_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="r_name">Nombre</Label>
                <Input
                  id="r_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="r_last">Apellidos</Label>
                <Input
                  id="r_last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="r_movil">Móvil</Label>
                <Input id="r_movil" value={movil} onChange={(e) => setMovil(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="r_centro">Nombre del centro</Label>
                <Input
                  id="r_centro"
                  value={centro}
                  onChange={(e) => setCentro(e.target.value)}
                  required
                />
              </div>
            </div>

            {errorMsg && (
              <div>
                <div className="text-destructive text-sm">{errorMsg}</div>
              </div>
            )}
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="registerForm" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrarme'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showToast && (
        <InviteToast
          title={<span>Revisa tu correo para acceder a tu cuenta</span>}
          onClose={() => {
            setShowToast(false);
          }}
        />
      )}
    </>
  );
}
