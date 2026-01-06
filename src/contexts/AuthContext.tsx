import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { error } from '@/lib/logger';

interface User {
  id: string;
  email: string;
  name: string;
  last_name: string;
  role: string;
  company: string | null;
  photo?: string;
}

interface AuthContextType {
  user: User | null;
  companyName: string | null;
  companyId: string | null;
  login: (email: string, password: string) => Promise<string | void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initialAuthChecked = (function () {
    let v = false;
    return {
      get: () => v,
      set: (val: boolean) => {
        v = val;
      },
    };
  })();

  useEffect(() => {
    // Verificar si hay sesión activa (no silencioso la primera vez)
    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, _session) => {
      // On auth events, run a silent check to update session/profile without triggering global loading UI
      checkAuth(true);
    });

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Función para normalizar el nombre de la compañía para usar en URL

  // Sanitizar un dominio (ej: https://example.com/path -> example.com)
  const sanitizeDomain = (domain: string): string => {
    try {
      // Quitar protocolo si existe
      let d = domain.replace(/^https?:\/\//i, '');
      // Quedarse solo con el hostname
      d = d.split('/')[0];
      // Lowercase y eliminar caracteres raros
      return d.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    } catch {
      return domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    }
  };

  const checkAuth = async (silent = false) => {
    try {
      // Only show the global loading indicator on the first check or when explicitly not silent
      if (!silent && !initialAuthChecked.get()) setIsLoading(true);

      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data.session;

      if (session?.user) {
        const userId = session.user.id;
        // Obtener perfil del usuario desde "profiles"
        // Fetch profile using helper that supports different schemas
        const profile = await (await import('@/lib/supabase')).fetchProfileByUserId(userId);
        if (!profile) throw new Error('Profile not found');

        const role = profile?.role;

        // Obtener información de la compañía lo antes posible (para canonical URL)
        let companyData = null;
        if (profile?.company) {
          // Use RPC to fetch company row via SECURITY DEFINER to avoid RLS timing issues
          const { data: comp, error: compErr } = await supabase.rpc('get_company_by_id', {
            p_company: profile.company,
          });
          // RPC may return a row or an array depending on client; normalize to single object
          if (!compErr) companyData = Array.isArray(comp) ? comp[0] : comp;
        }
        // Si la compañía existe pero no tiene domain, cerrar sesión: una company debe tener domain
        if (profile?.company && (!companyData || !companyData.domain)) {
          error('Company missing domain for company id: ' + profile.company);
          await supabase.auth.signOut();
          setUser(null);
          setCompanyId(null);
          setCompanyName(null);
          initialAuthChecked.set(true);
          if (!silent) setIsLoading(false);
          return;
        }

        // Siempre establecer companyId y companyName (si hay dominio) inmediatamente
        setCompanyId(profile?.company ?? null);
        const companyUrlName = companyData?.domain ? sanitizeDomain(companyData.domain) : null;
        if (companyUrlName) setCompanyName(companyUrlName);

        if (role === 'professional' || role === 'client') {
          setUser({
            id: userId,
            email: session.user.email || '',
            name: profile?.name || '',
            last_name: profile?.last_name || '',
            role: role,
            company: profile?.company || null,
            photo: profile?.photo_path || undefined,
          });
        } else {
          // Not an allowed role
          await supabase.auth.signOut();
          setUser(null);
          setCompanyId(null);
          setCompanyName(null);
        }
      } else {
        setUser(null);
        setCompanyId(null);
        setCompanyName(null);
      }
    } catch (err) {
      error('Error checking auth:', err);
      await supabase.auth.signOut().catch(() => null);
      setUser(null);
      setCompanyId(null);
      setCompanyName(null);
    } finally {
      // Mark we ran initial check
      initialAuthChecked.set(true);
      if (!silent) setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      const userId = data.user?.id;
      if (!userId) throw new Error('No user in session');

      // Obtener perfil (robusto para distintos esquemas de columna)
      const profile = await (await import('@/lib/supabase')).fetchProfileByUserId(userId);
      if (!profile) throw new Error('Profile not found');

      // Obtener compañía si aplica
      let companyData = null;
      if (profile?.company) {
        // Use RPC to fetch company row via SECURITY DEFINER to avoid RLS timing issues
        const { data: comp, error: compErr } = await supabase.rpc('get_company_by_id', {
          p_company: profile.company,
        });
        if (!compErr) companyData = Array.isArray(comp) ? comp[0] : comp;
      }

      // Enforce presence of domain on the company
      if (profile?.company && (!companyData || !companyData.domain)) {
        // Sign out to avoid inconsistent state and raise an actionable error
        await supabase.auth.signOut().catch(() => null);
        throw new Error('La compañía asociada no tiene domain configurado. Contacta a soporte.');
      }

      setUser({
        id: userId,
        email: data.user?.email || '',
        name: profile?.name || '',
        last_name: profile?.last_name || '',
        role: profile?.role || '',
        company: profile?.company || null,
        photo: profile?.photo_path || undefined,
      });

      setCompanyId(profile?.company ?? null);
      // Prefer domain if available
      const companyUrlName = companyData?.domain ? sanitizeDomain(companyData.domain) : 'company';
      setCompanyName(companyUrlName);

      // Return company url name so callers can navigate immediately
      return companyUrlName;
    } catch (err: any) {
      error('Login error:', err);
      throw err;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCompanyName(null);
    setCompanyId(null);
  };

  return (
    <AuthContext.Provider value={{ user, companyName, companyId, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
