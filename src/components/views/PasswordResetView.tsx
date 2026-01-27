import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Cleanup: simplify password reset handler and remove unused variables
export function PasswordResetView() {
  const { token: paramToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(paramToken ?? null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Store the email from the Supabase session so we can provide a username field for password managers and accessibility
  const [email, setEmail] = useState<string | null>(null);

  const { logout } = useAuth();

  useEffect(() => {
    (async () => {
      if (!token) {
        // Initialize and feature-detect auth helpers
        try {
          // no-op: keep minimal runtime checks if needed
        } catch {
          /* ignore */
        }

        // Check query param invite_token first (e.g. /auth/password-reset?invite_token=...)
        try {
          const sp = new URLSearchParams(window.location.search);
          const invite = sp.get('invite_token');
          const qtoken = sp.get('token');
          const access = sp.get('access_token');
          const refresh = sp.get('refresh_token');

          // If explicit access token present in query, set it as session so user is authenticated
          if (access) {
            try {
              if (typeof (supabase.auth as any).setSession === 'function') {
                await (supabase.auth as any).setSession({
                  access_token: access,
                  refresh_token: refresh ?? undefined,
                });
              } else if (typeof (supabase.auth as any).getSessionFromUrl === 'function') {
                const frag =
                  `access_token=${access}` + (refresh ? `&refresh_token=${refresh}` : '');
                try {
                  window.location.hash = frag;
                } catch {
                  /* ignore */
                }
                try {
                  await (supabase.auth as any).getSessionFromUrl();
                } catch {
                  /* ignore */
                }
              }
              const sessionRes = await supabase.auth.getSession();
              if (sessionRes?.data?.session?.user?.email)
                setEmail(sessionRes.data.session.user.email);
            } catch {
              /* ignore */
            }
          }

          if (invite) {
            setToken(invite);
            return;
          }
          // Show any error passed via query param (our server function sends JSON-encoded errors)
          const errParam = sp.get('error');
          if (errParam) {
            try {
              const decoded = decodeURIComponent(errParam);
              const parsed = JSON.parse(decoded);
              // prefer a human message if present, otherwise show message
              setError(parsed?.message || decoded);
            } catch {
              try {
                setError(decodeURIComponent(errParam));
              } catch {
                setError(errParam);
              }
            }
            return;
          }
          if (qtoken) {
            // Some flows provide the reset token under `token` query param (support both)
            // If the token looks like a URL-encoded hash (contains access_token/refresh_token),
            // move it into location.hash and ask Supabase to parse it so a session is created.
            try {
              const decoded = decodeURIComponent(qtoken);
              const containsAuthFrag =
                decoded.includes('access_token=') || decoded.includes('refresh_token=');
              if (containsAuthFrag) {
                const frag = decoded.startsWith('#')
                  ? decoded
                  : decoded.startsWith('?')
                    ? decoded.slice(1)
                    : decoded;
                // Set hash and attempt to let supabase parse the session from url
                try {
                  window.location.hash = frag;
                } catch {
                  /* ignore */
                }
                if (typeof (supabase.auth as any).getSessionFromUrl === 'function') {
                  try {
                    await (supabase.auth as any).getSessionFromUrl();
                  } catch {
                    /* ignore */
                  }
                }
                // Try update email from any newly created session
                try {
                  const sessionRes = await supabase.auth.getSession();
                  if (sessionRes?.data?.session?.user?.email)
                    setEmail(sessionRes.data.session.user.email);
                } catch {
                  /* ignore */
                }
              }
            } catch {
              /* ignore decode errors */
            }

            setToken(qtoken);
            return;
          }
        } catch {
          /* ignore */
        }

        // Check hash for either path token or fragment query (handles #/auth/password-reset?... and #access_token=...)
        const hash = window.location.hash || '';

        // If Supabase left auth fragments like access_token=..., try to force session parsing
        if (hash.includes('access_token=') || hash.includes('refresh_token=')) {
          if (typeof (supabase.auth as any).getSessionFromUrl === 'function') {
            try {
              await (supabase.auth as any).getSessionFromUrl();
            } catch {
              /* ignore */
            }
          } else {
            // Fallback: parse fragment and set session manually
            try {
              const frag = hash.startsWith('#') ? hash.slice(1) : hash;
              const params = new URLSearchParams(frag.replace(/^\/?/, ''));
              const access = params.get('access_token');
              const refresh = params.get('refresh_token');
              if (access && typeof (supabase.auth as any).setSession === 'function') {
                try {
                  await (supabase.auth as any).setSession({
                    access_token: access,
                    refresh_token: refresh ?? undefined,
                  });
                } catch {
                  /* ignore */
                }
              }
            } catch {
              /* ignore */
            }
          }

          // Try update email from any newly created session
          try {
            const sessionRes = await supabase.auth.getSession();
            if (sessionRes?.data?.session?.user?.email)
              setEmail(sessionRes.data.session.user.email);
          } catch {
            /* ignore */
          }
        }

        // handle links like /_/#/auth/password-reset/{TOKEN}
        const m = hash.match(/\/auth\/password-reset\/([^\/?#]+)/);
        if (m) {
          setToken(m[1]);
          return;
        }

        // handle links like #/auth/password-reset?invite_token=...&next=...
        const idx = hash.indexOf('/auth/password-reset');
        if (idx !== -1) {
          const frag = hash.slice(idx); // /auth/password-reset?invite_token=...&next=...
          const qIdx = frag.indexOf('?');
          if (qIdx !== -1) {
            const search = frag.slice(qIdx);
            try {
              const sp2 = new URLSearchParams(search);
              const inv = sp2.get('invite_token');
              if (inv) {
                setToken(inv);
                return;
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    })();
  }, [token]);

  // Fetch session email (if any) so we can provide a username field for password managers/accessibility
  useEffect(() => {
    (async () => {
      try {
        const sessionRes = await supabase.auth.getSession();
        setEmail(sessionRes.data.session?.user?.email ?? null);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await supabase.auth.getSession();
    } catch {
      /* ignore */
    }
    if (!token) {
      // continue: later block will explicitly check for session and error if missing
    }
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      // If no explicit token param, allow flow when a Supabase session was created from the fragment
      if (!token) {
        try {
          const check = await supabase.auth.getSession();
          if (!check.data.session) {
            setError('Token no encontrado');
            setLoading(false);
            return;
          }
        } catch {
          setError('Token no encontrado');
          setLoading(false);
          return;
        }
      }

      // Supabase: ensure session available then update password
      const sessionRes = await supabase.auth.getSession();
      if (!sessionRes.data.session) {
        setError(
          'El enlace de restablecimiento debe abrirse desde el correo (el token debe incluirse en la sesión de Supabase).'
        );
        setLoading(false);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        // Supabase may reject identical passwords with an error like
        // "New password should be different from the old password." —
        // this is enforced server-side. Treat this specific error as success
        // because the user's requested password is already in effect.
        const msg = String(updateErr?.message || '');
        if (
          msg.includes('New password should be different') ||
          msg.toLowerCase().includes('same as')
        ) {
          try {
            await logout();
          } catch {
            /* ignore */
          }
          setSuccess(true);
          setLoading(false);
          // Give the user 2s extra to see the success message before redirecting
          setTimeout(() => navigate('/login'), 3800);
          return;
        }

        throw updateErr;
      }

      // Clear any existing session so the app does not auto-redirect to the panel
      try {
        await logout();
      } catch {
        // ignore logout errors
      }

      setSuccess(true);
      // Extra 2s so user can read the success message
      setTimeout(() => navigate('/login'), 3800);
    } catch (err: any) {
      const msg = String(err?.message || '');
      // Translate common Supabase English messages to Spanish for UX
      if (msg.includes('Password should be at least')) {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(msg || 'Error restableciendo contraseña');
      }
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
              <p className="font-medium">✅ Contraseña restablecida correctamente.</p>
              <p className="text-sm">Serás redirigido al login en breve.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Hidden but screen-reader-accessible username field so browsers and password managers can link the account email with the new password. */}
              <div className="sr-only">
                <Label htmlFor="username">Email</Label>
                <input
                  id="username"
                  name="username"
                  type="email"
                  autoComplete="username"
                  value={email ?? ''}
                  readOnly
                  aria-hidden={email ? undefined : true}
                  className="sr-only"
                />
              </div>

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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Procesando...' : 'Restablecer contraseña'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Alert en esquina inferior derecha */}
      {error && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto z-50 w-auto md:max-w-md animate-in slide-in-from-right">
          <Alert
            variant="destructive"
            className="border-destructive/50 [&>svg]:top-3.5 [&>svg+div]:translate-y-0"
          >
            <AlertCircle className="h-5 w-5 text-destructive" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

export default PasswordResetView;
