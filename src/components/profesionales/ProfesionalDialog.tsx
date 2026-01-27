import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
import { CalendarIcon, UserStar, X, Mail, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { debug, error } from '@/lib/logger';
import { getFilePublicUrl, supabase } from '@/lib/supabase';
import useResolvedFileUrl from '@/hooks/useResolvedFileUrl';

import { useAuth } from '@/contexts/AuthContext';

interface Profesional {
  id?: string;
  name: string;
  last_name: string;
  dni: string;
  email: string;
  phone: string;
  company: string;
  photo?: string;
  photo_path?: string | null;
  birth_date?: string;
  address?: string;
  notes?: string;
  role?: string;
}

interface ProfesionalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profesional?: Profesional | null;
  onSave: (refresh?: boolean) => void;
}

export function ProfesionalDialog({
  open,
  onOpenChange,
  profesional,
  onSave,
}: ProfesionalDialogProps) {
  const { companyId, user: authUser, refreshProfile } = useAuth();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<Profesional>({
    name: '',
    last_name: '',
    dni: '',
    email: '',
    phone: '',
    company: '',
  });
  const [fechaNacimiento, setFechaNacimiento] = useState<Date | undefined>(undefined);
  const [edad, setEdad] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Autofocus removed per UX decision
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // removePhoto state to allow clearing preview / file during edit
  const [removePhoto, setRemovePhoto] = useState(false);
  const [phoneError, setPhoneError] = useState<string>('');

  // Resolve existing profile photo (public or signed URL)
  const resolvedProfesionalPhoto = useResolvedFileUrl(
    'profile_photos',
    profesional?.id || null,
    (profesional as any)?.photo_path || null
  );

  useEffect(() => {
    if (profesional) {
      setFormData(profesional);
      if (profesional.birth_date) {
        const date = new Date(profesional.birth_date);
        setFechaNacimiento(date);
        calcularEdad(date);
      }
      setRemovePhoto(false);

      // Try to load authoritative email from profiles table if missing (use helper to avoid malformed OR queries)
      (async () => {
        try {
          if (!profesional.email) {
            const api = await import('@/lib/supabase');
            const profile = await api.fetchProfileByUserId(profesional.id!);
            if (profile?.email) setFormData((prev) => ({ ...prev, email: profile.email }));
          }
        } catch {
          /* ignore */
        }
      })();
    } else {
      setFormData({
        name: '',
        last_name: '',
        dni: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        notes: '',
      });
      setFechaNacimiento(undefined);
      setEdad(null);
      setPhotoFile(null);
      setPhotoPreview(null);
    }
    setPhoneError('');
  }, [profesional, open]);

  // Update photo preview when the resolved URL or the selected file changes (without touching formData)
  useEffect(() => {
    if (profesional?.photo_path) {
      if (!photoFile) setPhotoPreview(resolvedProfesionalPhoto || null);
    } else {
      setPhotoPreview(null);
    }
  }, [resolvedProfesionalPhoto, photoFile, profesional?.photo_path]);

  const [sendingReset, setSendingReset] = useState(false);
  const [showResetSent, setShowResetSent] = useState(false);

  const handleSendResetConfirm = async () => {
    if (!formData.email) {
      alert('El profesional no tiene email');
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: window.location.origin + '/auth/password-reset',
      });
      if (error) throw error;
      setShowResetSent(true);
      setTimeout(() => setShowResetSent(false), 5000);
    } catch (err: any) {
      error('Error enviando reset:', err);
      alert(err?.message || 'Error enviando reset de contraseña');
    } finally {
      setSendingReset(false);
    }
  };

  const calcularEdad = (fecha: Date) => {
    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const mes = hoy.getMonth() - fecha.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
      edad--;
    }
    setEdad(edad);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setFechaNacimiento(date);
    if (date) {
      calcularEdad(date);
    } else {
      setEdad(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build payload for non-file updates
      const payload: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (
          key === 'id' ||
          key === 'created' ||
          key === 'updated' ||
          key === 'photo' ||
          key === 'birth_date' ||
          key === 'email'
        )
          return;
        if (value !== undefined && value !== null && value !== '') payload[key] = String(value);
      });

      // Email
      if (!profesional?.id) {
        if (formData.email) {
          payload.email = formData.email;
        }
      } else if (formData.email && formData.email !== profesional.email) {
        payload.email = formData.email;
      }

      // Fecha
      if (fechaNacimiento) payload.birth_date = format(fechaNacimiento, 'yyyy-MM-dd');

      // Role/company for create
      if (!profesional?.id) {
        payload.role = 'professional';
        if (companyId) payload.company = companyId;
      }

      let savedUser: any = null;

      // Use server-side functions to avoid RLS issues
      const api = await import('@/lib/supabase');
      if (profesional?.id) {
        // Update via Edge Function
        const okSession = await api.ensureValidSession();
        if (!okSession) throw new Error('session_invalid');
        const token = await api.getAuthToken();
        if (!token) throw new Error('missing_token');

        const fnRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-professional`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ profile_id: profesional.id, ...payload }),
          }
        );
        const fnJson = await fnRes.json().catch(() => null);
        if (!fnRes.ok || !fnJson || !fnJson.ok) {
          throw new Error(
            'failed_to_update_professional: ' + (fnJson?.error || JSON.stringify(fnJson))
          );
        }
        const data = Array.isArray(fnJson.updated) ? fnJson.updated[0] : fnJson.updated;
        savedUser = data;
      } else {
        // Create via Edge Function
        const okSession = await api.ensureValidSession();
        if (!okSession) throw new Error('session_invalid');
        const token = await api.getAuthToken();
        if (!token) throw new Error('missing_token');

        const fnRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-professional`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          }
        );
        const fnJson = await fnRes.json().catch(() => null);
        if (!fnRes.ok || !fnJson || !fnJson.ok) {
          throw new Error(
            'failed_to_create_professional: ' + (fnJson?.error || JSON.stringify(fnJson))
          );
        }
        const inserted = Array.isArray(fnJson.inserted) ? fnJson.inserted[0] : fnJson.inserted;
        savedUser = inserted;
      }

      // Normalize the identifier we'll use for storage paths and direct updates
      const savedUserId =
        savedUser && (savedUser.id || savedUser.user)
          ? savedUser.id || savedUser.user
          : typeof savedUser === 'string'
            ? savedUser
            : null;
      if (!savedUserId) {
        throw new Error('No se pudo determinar el identificador del perfil guardado');
      }

      // If a new photo file was selected, upload it to storage and update profile.photo_path
      if (photoFile && savedUserId) {
        try {
          const originalFilename = photoFile.name;
          const ext = originalFilename.includes('.')
            ? originalFilename.slice(originalFilename.lastIndexOf('.'))
            : '';
          const filename = `${Date.now()}-${(crypto as any)?.randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2, 10)}${ext}`;
          const storagePath = `${filename}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('profile_photos')
            .upload(storagePath, photoFile);
          // Log response for debugging
          if (uploadErr) {
            error('Upload error', {
              bucket: 'profile_photos',
              path: storagePath,
              error: uploadErr,
            });
            throw uploadErr;
          }
          debug('Upload success', {
            bucket: 'profile_photos',
            path: storagePath,
            data: uploadData,
          });

          // Attempt to update profile.photo_path via helper, with fallbacks to direct updates
          // Update photo_path via Edge Function to avoid RLS
          const okSession2 = await api.ensureValidSession();
          if (!okSession2) throw new Error('session_invalid');
          const token2 = await api.getAuthToken();
          if (!token2) throw new Error('missing_token');

          const patchPhotoRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-professional`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
              body: JSON.stringify({ profile_id: savedUserId, photo_path: filename }),
            }
          );
          const patchPhotoJson = await patchPhotoRes.json().catch(() => null);
          if (!patchPhotoRes.ok || !patchPhotoJson || !patchPhotoJson.ok) {
            // fallback to direct updates if function failed
            const byId = await supabase
              .from('profiles')
              .update({ photo_path: filename })
              .eq('id', savedUserId)
              .select()
              .maybeSingle();
            if (byId.error) throw byId.error;
            if (!byId.data) {
              const byUser = await supabase
                .from('profiles')
                .update({ photo_path: filename })
                .eq('user', savedUserId)
                .select()
                .maybeSingle();
              if (byUser.error) throw byUser.error;
              if (!byUser.data)
                throw new Error('No se pudo actualizar photo_path por id ni por user');
            }
          }

          // Verify persisted using helper to avoid malformed OR queries
          const verified = await api.fetchProfileByUserId(savedUserId);
          if (!verified || verified.photo_path !== filename) {
            throw new Error('photo_path no persistió después del upload');
          }

          // If we updated the currently authenticated user's profile, refresh the global auth profile
          try {
            if (refreshProfile && authUser && String(verified.user) === String(authUser.id)) {
              await refreshProfile();
            }
          } catch {
            // ignore refresh errors
          }

          // Update preview to public/signed URL — prefer root filename then fallback to id-prefixed path
          let previewUrl =
            getFilePublicUrl('profile_photos', null, filename) ||
            getFilePublicUrl('profile_photos', savedUserId, filename);
          if (!previewUrl) {
            try {
              const signedRoot = await supabase.storage
                .from('profile_photos')
                .createSignedUrl(`${filename}`, 60 * 60);
              previewUrl = signedRoot?.data?.signedUrl || previewUrl;
            } catch {
              // ignore
            }
            if (!previewUrl) {
              try {
                const signed = await supabase.storage
                  .from('profile_photos')
                  .createSignedUrl(`${savedUserId}/${filename}`, 60 * 60);
                previewUrl = signed?.data?.signedUrl || previewUrl;
              } catch {
                // ignore
              }
            }
          }
          setPhotoPreview(previewUrl || null);
        } catch (e) {
          // Non-fatal: log and continue
          error('Error subiendo foto:', e);
        }
      } else if (removePhoto && savedUserId) {
        try {
          // Remove photo_path from profile
          const rem = await api.updateProfileByUserId(savedUserId, { photo_path: null });
          if (rem?.error) throw rem.error;
          setPhotoPreview(null);

          // If we removed our own photo, refresh global auth profile so sidebar updates
          try {
            if (refreshProfile && authUser && rem?.data && String(rem.data.user) === String(authUser.id)) {
              await refreshProfile();
            }
          } catch {
            // ignore
          }
        } catch (e) {
          error('Error removiendo foto:', e);
        }
      }

      // If we just created a new profile, request the send-invite function to generate token and (optionally) send the invite email
      if (!profesional?.id) {
        try {
          const lib = await import('@/lib/supabase');
          let ok = await lib.ensureValidSession();
          if (!ok) {
            alert(
              'La sesión parece inválida o ha expirado. Por favor cierra sesión e inicia sesión de nuevo para reenviar la invitación.'
            );
          } else {
            let token = await lib.getAuthToken();
            if (!token) {
              console.warn('No token available after ensureValidSession()');
              alert(
                'No se pudo obtener un token válido. Por favor cierra sesión e inicia sesión de nuevo.'
              );
            } else {
              try {
                try {
                  const sendInvite = await import('@/lib/invites');
                  const inviteKey = (savedUserId as string) || formData.email || '';
                  if (!inviteKey) throw new Error('missing_profile_id_or_email');
                  const { res, json } = await sendInvite.default(inviteKey);
                  if (res.ok) {
                    // Persist and dispatch a global invite toast so it survives navigation/close
                    const title = 'Invitación enviada al profesional';
                    try {
                      localStorage.setItem(
                        'tactivo.inviteToast',
                        JSON.stringify({ title, durationMs: 7000 })
                      );
                    } catch { }
                    try {
                      window.dispatchEvent(
                        new CustomEvent('tactivo.invite', { detail: { title, durationMs: 7000 } })
                      );
                    } catch { }
                  } else {
                    // Show helpful info to user
                    const hint =
                      (json?.auth_error &&
                        (json.auth_error.message || json.auth_error.error_description)) ||
                      json?.message ||
                      json?.error ||
                      json?.code ||
                      'Error';
                    const debug = json?.auth_debug
                      ? '\nDetalles del servidor: ' + JSON.stringify(json.auth_debug)
                      : '';
                    alert(
                      'La invitación fue creada pero no se pudo ejecutar la función de envío: ' +
                      hint +
                      debug
                    );
                  }
                } catch (e: any) {
                  console.warn('Error calling send-invite helper', e);
                  alert('Error llamando a la función de envío: ' + (e?.message || String(e)));
                }
              } catch (e: any) {
                console.warn('Error calling send-invite function', e);
                alert('Error llamando a la función de envío: ' + (e?.message || String(e)));
              }
            }
          }
        } catch (e: any) {
          console.warn('Error calling send-invite function', e);
        }
      }

      onSave();
      onOpenChange(false);
      setRemovePhoto(false);
    } catch (err: any) {
      error('Error al guardar profesional:', err);
      // Detect PostgREST schema cache error (common after migrations)
      const msg = String(err?.message || err || '');
      if (msg.includes('PGRST204') || msg.includes("Could not find the 'email' column")) {
        alert(
          'Error al guardar: parece haber un problema con la caché del esquema de PostgREST. Ve a Supabase Dashboard → Settings → API → Reload schema y prueba de nuevo.'
        );
      } else {
        alert('Error al guardar el profesional: ' + (err?.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Profesional, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Validar teléfono en tiempo real
    if (field === 'phone') {
      const phoneStr = String(value);
      if (phoneStr && !/^\+?\d{9,15}$/.test(phoneStr.replace(/\s/g, ''))) {
        setPhoneError('Formato de teléfono inválido');
      } else {
        setPhoneError('');
      }
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <UserStar className="h-5 w-5" />
              <DialogTitle>{profesional ? 'Editar Profesional' : 'Crear Profesional'}</DialogTitle>
            </div>
            <DialogDescription>
              {profesional
                ? 'Modifica los datos del profesional'
                : 'Completa los datos del nuevo profesional'}
            </DialogDescription>
          </DialogHeader>

          <form
            id="profesional-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto space-y-6 px-1 mt-4"
          >
            <div className="space-y-4">
              {/* Datos personales */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    ref={(el: HTMLInputElement) => (nameInputRef.current = el)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Apellidos *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name || ''}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI *</Label>
                  <Input
                    id="dni"
                    value={formData.dni || ''}
                    onChange={(e) => handleChange('dni', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    required
                  />
                  {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="email">Email *</Label>
                  {!profesional?.id && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                          <p>Al crear el perfil, se enviará un correo de invitación al usuario</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={!!profesional?.id}
                    readOnly={!!profesional?.id}
                    required
                    className="w-full h-10"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendResetConfirm}
                    disabled={!profesional?.id || !formData.email || sendingReset}
                    className="w-full justify-center h-10"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {sendingReset ? 'Enviando...' : 'Restablecer contraseña'}
                  </Button>
                </div>
              </div>
              {/* Foto y Dirección en la misma línea */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="photo">Foto</Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        id="photo"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          handlePhotoChange(e);
                          setRemovePhoto(false);
                        }}
                      />
                      <label
                        htmlFor="photo"
                        className="flex items-center justify-between h-10 px-3 py-2 text-sm rounded-md border border-border bg-background cursor-pointer hover:bg-muted hover:text-foreground"
                      >
                        <span>{photoFile ? photoFile.name : 'Elegir archivo'}</span>
                        {(photoFile || photoPreview) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setPhotoFile(null);
                              setPhotoPreview(null);
                              setRemovePhoto(true);
                              setFormData((prev) => ({ ...prev, photo: '' }));
                              const input = document.getElementById('photo') as HTMLInputElement;
                              if (input) input.value = '';
                            }}
                            className="ml-2 text-foreground hover:text-destructive p-1 rounded"
                            aria-label="Borrar foto"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </label>
                    </div>
                    {photoPreview && (
                      <div className="relative w-1/2 aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="object-cover w-full h-full"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                  />
                </div>

                {/* Fecha de nacimiento + edad con Notas debajo en toda la fila */}
                <div className="col-span-2 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fecha de Nacimiento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal h-10',
                              !fechaNacimiento && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {fechaNacimiento
                              ? format(fechaNacimiento, 'dd/MM/yyyy')
                              : 'Seleccionar fecha'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={fechaNacimiento}
                            onSelect={handleDateSelect}
                            captionLayout="dropdown"
                            fromYear={1920}
                            toYear={new Date().getFullYear()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Edad</Label>
                      <Input
                        value={edad !== null ? `${edad} años` : ''}
                        disabled
                        className="bg-muted h-10"
                      />
                    </div>
                  </div>

                  {/* Notas (debajo de fecha, ocupando toda la fila) */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas</Label>
                    <LazyRichTextEditor
                      value={formData.notes || ''}
                      onChange={(html: string) => handleChange('notes', html)}
                      placeholder="Añade notas sobre el profesional..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>

          <DialogFooter>
            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button type="submit" form="profesional-form" disabled={loading}>
                {loading ? (
                  <>
                    Guardando
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showResetSent &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[99999] w-96 pointer-events-none">
            <div className="pointer-events-auto">
              <Alert
                variant="success"
                className="shadow-lg [&>svg]:top-3.5 [&>svg+div]:translate-y-0"
              >
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-start gap-2">
                    <div>
                      <p className="font-semibold text-green-800">
                        Email enviado a {formData.email}
                      </p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
