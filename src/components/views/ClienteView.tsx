import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { error as logError } from '@/lib/logger';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
  CalendarIcon,
  ChevronDown,
  User,
  CheckCircle,
  XCircle,
  HelpCircle,
  Trash,
  Loader2,
} from 'lucide-react';
import ActionButton from '@/components/ui/ActionButton';
import { cn } from '@/lib/utils';
import { getFilePublicUrl, supabase } from '@/lib/supabase';
import useResolvedFileUrl from '@/hooks/useResolvedFileUrl';
import { getProfilesByIds } from '@/lib/profiles';

import ClientPrograms from '@/components/clientes/ClientPrograms';
import { useClientPrograms } from '@/components/clientes/useClientPrograms';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
import { Badge } from '@/components/ui/badge';
import type { Cliente } from '@/types/cliente';
import type { Event } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';
import { EventDialog } from '@/components/eventos/EventDialog';
import { parseDatetime } from '@/lib/date';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { ViewType } from '@/App';

export default function ClienteView() {
  const { companyName, uid } = useParams<{ companyName: string; uid: string }>();
  const navigate = useNavigate();
  const isNewCliente = !uid || uid === 'nuevo';

  const { companyId } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const clientProgramsApi = useClientPrograms({ cliente, companyId });
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<Cliente>({
    name: '',
    last_name: '',
    dni: '',
    email: '',
    phone: '',
    company: '',
    session_credits: 0,
    class_credits: 0,
  });
  const [fechaNacimiento, setFechaNacimiento] = useState<Date | undefined>(undefined);
  const [edad, setEdad] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [phoneError, setPhoneError] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [eventos, setEventos] = useState<Event[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  // Local cache of profile data for professionals referenced by eventos (fallback when expand is missing)
  const [localProfilesMap, setLocalProfilesMap] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('datos');
  const [loadingCliente, setLoadingCliente] = useState(!isNewCliente);
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    try {
      const saved = localStorage.getItem('tactivo.currentView') as ViewType | null;
      return saved || 'clientes';
    } catch {
      return 'clientes';
    }
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<null | {
    type: 'back' | 'view';
    view?: ViewType;
  }>(null);

  const initialFormRef = useRef<Cliente | null>(null);
  const [hasEventDirty, setHasEventDirty] = useState(false);

  useEffect(() => {
    const handler = (e: any) => setHasEventDirty(Boolean(e?.detail?.dirty));
    window.addEventListener('event-dialog-dirty', handler as EventListener);
    return () => {
      window.removeEventListener('event-dialog-dirty', handler as EventListener);
    };
  }, []);

  const resolvedClientePhoto = useResolvedFileUrl(
    'profile_photos',
    cliente?.id || null,
    cliente?.photo_path || null
  );

  const calcularEdad = useCallback((fecha: Date) => {
    const hoy = new Date();
    let years = hoy.getFullYear() - fecha.getFullYear();
    const mes = hoy.getMonth() - fecha.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
      years--;
    }
    setEdad(years);
  }, []);

  const loadEventos = useCallback(
    async (clienteId: string) => {
      if (!clienteId) return;

      setLoadingEventos(true);
      try {
        let resolvedProfileId: string | null = null;
        let resolvedUserId: string | null = null;
        try {
          const { data: profRows, error: profErr } = await supabase.rpc(
            'get_profiles_by_ids_for_clients',
            {
              p_ids: [clienteId],
              p_company: companyId,
            }
          );
          if (!profErr && profRows && (profRows as any[]).length > 0) {
            const row = (profRows as any[])[0];
            resolvedProfileId = row.id ?? null;
            resolvedUserId = row.user ?? null;
          } else {
            const { data: profileRow, error: selectErr } = await supabase
              .from('profiles')
              .select('id, user')
              .eq('id', clienteId)
              .limit(1)
              .maybeSingle();
            if (!selectErr && profileRow) {
              resolvedProfileId = (profileRow as any).id ?? null;
              resolvedUserId = (profileRow as any).user ?? null;
            }
          }
        } catch {
          // ignore resolution errors
        }

        const { data: rpcRecords, error } = await supabase.rpc('get_events_for_company', {
          p_company: companyId,
        });
        if (error) throw error;
        const recordsAll = Array.isArray(rpcRecords) ? rpcRecords : rpcRecords ? [rpcRecords] : [];

        const clientMatches = (
          clientsField: any,
          pid: string,
          resolvedProfile: string | null,
          resolvedUser: string | null
        ) => {
          const arr = Array.isArray(clientsField)
            ? clientsField
            : clientsField
              ? [clientsField]
              : [];
          if (!arr || arr.length === 0) return false;
          const normalized = arr.map((x: any) => String(x));
          const pidStr = String(pid);
          if (normalized.includes(pidStr)) return true;
          if (resolvedProfile && normalized.includes(String(resolvedProfile))) return true;
          if (resolvedUser && normalized.includes(String(resolvedUser))) return true;
          return false;
        };

        const records = (recordsAll || []).filter((r: any) => {
          const clientsField =
            r.client ?? r.client_user_ids ?? r.clientUserIds ?? r.clients ?? r.clientIds ?? null;
          return (
            clientMatches(clientsField, clienteId, resolvedProfileId, resolvedUserId) &&
            r.type === 'appointment'
          );
        });

        const profIds = new Set<string>();
        (records || []).forEach((r: any) => {
          const pros = Array.isArray(r.professional)
            ? r.professional
            : r.professional
              ? [r.professional]
              : [];
          pros.forEach((id: string) => profIds.add(id));
        });
        let profileMap: Record<string, any> = {};
        if (profIds.size > 0) {
          const ids = Array.from(profIds);
          const profilesMap = await getProfilesByIds(ids, companyId ?? undefined);
          profileMap = profilesMap || {};
        }
        const enriched = (records || []).map((r: any) => ({
          ...r,
          expand: {
            professional: (Array.isArray(r.professional)
              ? r.professional
              : r.professional
                ? [r.professional]
                : []
            )
              .map((id: string) => profileMap[id] || null)
              .filter(Boolean),
          },
        }));
        const sorted = (enriched || [])
          .slice()
          .sort((a: any, b: any) => {
            const da = parseDatetime(a.datetime);
            const db = parseDatetime(b.datetime);
            return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
          });
        setEventos(sorted);
      } catch (err) {
        logError('Error al cargar eventos:', err);
      } finally {
        setLoadingEventos(false);
      }
    },
    [companyId]
  );

  // Synchronize profiles for any professionals referenced in the loaded eventos
  useEffect(() => {
    (async () => {
      try {
        const ids = new Set<string>();
        (eventos || []).forEach((ev) => {
          const pros = Array.isArray(ev.professional)
            ? ev.professional
            : ev.professional
              ? [ev.professional]
              : [];
          pros.forEach((id: string) => ids.add(id));
        });
        const missing = Array.from(ids).filter((id) => !localProfilesMap[id]);
        if (missing.length > 0 && companyId) {
          const map = await getProfilesByIds(missing, companyId);
          setLocalProfilesMap((prev) => ({ ...prev, ...(map || {}) }));
        }
      } catch {
        // ignore
      }
    })();
  }, [eventos, companyId, localProfilesMap]);

  const ensureAuthoritativeEmail = useCallback(
    async (clienteId?: string) => {
      if (!clienteId) return;
      try {
        if (!cliente?.email) {
          const api = await import('@/lib/supabase');
          const profile = await api.fetchProfileByUserId(clienteId);
          if (profile?.email)
            setFormData((prev) => ({ ...prev, email: profile.email || prev.email }));
        }
      } catch (err) {
        logError('Error fetching authoritative email for client', err);
      }
    },
    [cliente]
  );

  useEffect(() => {
    const fetchCliente = async () => {
      if (isNewCliente) {
        resetFormData();
        setCliente(null);
        setLoadingCliente(false);
        return;
      }
      setLoadingCliente(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid as string)
          .maybeSingle();
        if (error || !data) throw error || new Error('Cliente no encontrado');
        setCliente(data as Cliente);
      } catch (err) {
        logError('Error al cargar cliente:', err);
        alert('No se pudo cargar el cliente');
        navigate(`/${companyName}/panel`);
      } finally {
        setLoadingCliente(false);
      }
    };

    fetchCliente();
  }, [uid, isNewCliente, navigate, companyName]);

  useEffect(() => {
    if (cliente) {
      const initial = {
        id: cliente.id,
        name: cliente.name || '',
        last_name: cliente.last_name || '',
        dni: cliente.dni || '',
        email: cliente.email || '',
        phone: cliente.phone || '',
        company: cliente.company || '',
        session_credits: cliente.session_credits ?? 0,
        class_credits: cliente.class_credits ?? 0,
        photo: cliente.photo || '',
        photo_path: cliente.photo_path ?? null,
        birth_date: cliente.birth_date ?? undefined,
        address: cliente.address || '',
        occupation: cliente.occupation || '',
        sport: cliente.sport || '',
        history: cliente.history || '',
        diagnosis: cliente.diagnosis || '',
        allergies: cliente.allergies || '',
        notes: cliente.notes || '',
      } as Cliente;
      setFormData(initial);
      initialFormRef.current = JSON.parse(JSON.stringify(initial));

      if (cliente.birth_date) {
        const date = new Date(cliente.birth_date);
        setFechaNacimiento(date);
        calcularEdad(date);
      }
      ensureAuthoritativeEmail(cliente.id!);
      loadEventos(cliente.id!);
    } else {
      resetFormData();
    }
    setPhoneError('');
  }, [cliente, ensureAuthoritativeEmail, loadEventos, calcularEdad]);

  useEffect(() => {
    if (cliente?.photo_path) {
      if (!photoFile) setPhotoPreview(resolvedClientePhoto || null);
    } else {
      setPhotoPreview(null);
    }
  }, [resolvedClientePhoto, photoFile, cliente?.photo_path]);

  const resetFormData = () => {
    const defaults: Cliente = {
      name: '',
      last_name: '',
      dni: '',
      email: '',
      phone: '',
      company: '',
      session_credits: 0,
      class_credits: 0,
    };
    setFormData(defaults);
    setFechaNacimiento(undefined);
    setEdad(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setEventos([]);
    setHasEventDirty(false);
    initialFormRef.current = JSON.parse(JSON.stringify(defaults));
  };

  const revertChanges = () => {
    // Revert form fields to the initial snapshot if available, or reset for a new client.
    if (initialFormRef.current) {
      setFormData(JSON.parse(JSON.stringify(initialFormRef.current)));
      if (initialFormRef.current.birth_date) {
        const d = new Date(initialFormRef.current.birth_date);
        setFechaNacimiento(d);
        calcularEdad(d);
      } else {
        setFechaNacimiento(undefined);
        setEdad(null);
      }
      setPhotoFile(null);
      setRemovePhoto(false);
      setPhotoPreview(resolvedClientePhoto || null);
      clientProgramsApi.resetToInitial();
      setHasEventDirty(false);
    } else {
      resetFormData();
    }
  };

  const handleEditEvent = async (eventId: string) => {
    try {
      const { data: rpcRecords, error } = await supabase.rpc('get_events_for_company', {
        p_company: companyId,
      });
      if (error) throw error;

      const recordsAll = Array.isArray(rpcRecords) ? rpcRecords : rpcRecords ? [rpcRecords] : [];
      const eventData = (recordsAll || []).find((r: any) => r.id === eventId);
      if (!eventData) throw new Error('event not found');
      const ids = [
        ...(Array.isArray(eventData.client)
          ? eventData.client
          : eventData.client
            ? [eventData.client]
            : []),
        ...(Array.isArray(eventData.professional)
          ? eventData.professional
          : eventData.professional
            ? [eventData.professional]
            : []),
      ];
      let profileMap: Record<string, any> = {};
      if (ids.length > 0) {
        const profilesMap = await getProfilesByIds(ids, companyId ?? undefined);
        profileMap = profilesMap || {};
      }
      const enriched = {
        ...eventData,
        expand: {
          client: (Array.isArray(eventData.client)
            ? eventData.client
            : eventData.client
              ? [eventData.client]
              : []
          )
            .map((id: string) => profileMap[id] || null)
            .filter(Boolean),
          professional: (Array.isArray(eventData.professional)
            ? eventData.professional
            : eventData.professional
              ? [eventData.professional]
              : []
          )
            .map((id: string) => profileMap[id] || null)
            .filter(Boolean),
        },
      };
      setSelectedEvent(enriched as any);
      setEventDialogOpen(true);
    } catch (err) {
      logError('Error cargando evento:', err);
    }
  };

  const handleEventSaved = (_refresh?: boolean) => {
    if (cliente?.id) loadEventos(cliente.id);
  };

  const isSaveDisabled = useMemo(() => {
    const requiredFilled = (val: unknown) => {
      if (val === undefined || val === null) return false;
      return String(val).trim() !== '';
    };

    const phoneValid = /^[0-9]{9}$/.test(formData.phone || '');
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formData.email || '').trim());

    const requiredFieldsOk = [
      formData.name,
      formData.last_name,
      formData.dni,
      formData.phone,
      formData.email,
    ].every(requiredFilled);

    return !requiredFieldsOk || !phoneValid || !!phoneError || !emailValid || !!emailError || loading;
  }, [formData, phoneError, emailError, loading]);

  const hasFormChanges = useMemo(() => {
    const orig = initialFormRef.current;
    if (!orig) return false;
    const keys = [
      'name',
      'last_name',
      'dni',
      'email',
      'phone',
      'company',
      'session_credits',
      'class_credits',
      'photo_path',
      'birth_date',
      'address',
      'occupation',
      'sport',
      'history',
      'diagnosis',
      'allergies',
      'notes',
    ];
    for (const k of keys) {
      if (k === 'birth_date') {
        const a =
          formData.birth_date ?? (fechaNacimiento ? format(fechaNacimiento, 'yyyy-MM-dd') : '');
        const b = String((orig as any).birth_date ?? '');
        if (String(a ?? '') !== String(b ?? '')) return true;
      } else {
        const a = String((formData as any)[k] ?? '');
        const b = String((orig as any)[k] ?? '');
        if (a !== b) return true;
      }
    }
    return false;
  }, [formData, fechaNacimiento]);

  const photoDirty =
    Boolean(photoFile) || (removePhoto && Boolean(initialFormRef.current?.photo_path));
  const isDirty =
    hasFormChanges || photoDirty || clientProgramsApi.hasPendingChanges || hasEventDirty;

  const handleDateSelect = (date: Date | undefined) => {
    setFechaNacimiento(date);
    if (date) {
      calcularEdad(date);
    } else {
      setEdad(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault?.();

    if (formData.phone && !/^[0-9]{9}$/.test(formData.phone)) {
      setPhoneError('El teléfono debe tener exactamente 9 dígitos');
      return;
    }

    setLoading(true);

    try {
      const payload: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (['id', 'created', 'updated', 'photo', 'birth_date', 'email'].includes(key)) return;
        if (value !== undefined && value !== null && value !== '') {
          if (key === 'session_credits' || key === 'class_credits') {
            const parsed = parseInt(String(value));
            payload[key] = String(isNaN(parsed) ? 0 : parsed);
          } else {
            payload[key] = String(value);
          }
        }
      });

      if (!cliente?.id) {
        if (formData.email) {
          payload.email = formData.email;
        }
      } else if (formData.email && formData.email !== cliente.email) {
        payload.email = formData.email;
        payload.emailVisibility = 'true';
      }

      if (fechaNacimiento) payload.birth_date = format(fechaNacimiento, 'yyyy-MM-dd');

      if (!cliente?.id) {
        payload.role = 'client';
        if (companyId) payload.company = companyId;
      }

      let savedUser: any = null;
      let savedUserId: string | null = null;

      if (photoFile) {
        const originalFilename = photoFile.name;
        const ext = originalFilename.includes('.')
          ? originalFilename.slice(originalFilename.lastIndexOf('.'))
          : '';
        const filename = `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)}${ext}`;

        if (cliente?.id) {
          const lib = await import('@/lib/supabase');
          const okSession = await lib.ensureValidSession();
          if (!okSession) throw new Error('session_invalid');
          const token = await lib.getAuthToken();
          if (!token) throw new Error('missing_token');

          const fnRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-client`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ profile_id: cliente.id, ...payload }),
            }
          );
          const fnJson = await fnRes.json().catch(() => null);
          if (!fnRes.ok || !fnJson || !fnJson.ok) {
            throw new Error(
              'failed_to_update_client: ' + (fnJson?.error || JSON.stringify(fnJson))
            );
          }
          const data = Array.isArray(fnJson.updated) ? fnJson.updated[0] : fnJson.updated;
          savedUser = data;
          savedUserId =
            savedUser && (savedUser.id || savedUser.user)
              ? savedUser.id || savedUser.user
              : cliente.id;

          try {
            // Upload under profile folder so the saved photo_path matches the stored object
            const storagePath = `${savedUserId}/${filename}`;
            const { error: uploadErr } = await supabase.storage
              .from('profile_photos')
              .upload(storagePath, photoFile);
            if (uploadErr) throw uploadErr;

            const photoPathToStore = storagePath;
            const patchPhotoRes = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-client`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ profile_id: savedUserId, photo_path: photoPathToStore }),
              }
            );
            const patchPhotoJson = await patchPhotoRes.json().catch(() => null);
            if (!patchPhotoRes.ok || !patchPhotoJson || !patchPhotoJson.ok) {
              throw new Error(
                'failed_to_set_photo_path: ' +
                (patchPhotoJson?.error || JSON.stringify(patchPhotoJson))
              );
            }
            const api2 = await import('@/lib/supabase');
            const verified = await api2.fetchProfileByUserId(savedUserId!);
            if (!verified || verified.photo_path !== photoPathToStore)
              throw new Error('photo_path no persistió para el cliente');

            // Request server-side signed URL and use as preview to avoid unsigned GETs
            try {
              const fnUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/get-signed-url`;
              const signedRes = await fetch(fnUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ bucket: 'profile_photos', path: photoPathToStore, expires: 60 * 60 }),
              });
              const signedJson = await signedRes.json().catch(() => null);
              if (signedRes.ok && signedJson && signedJson.signedUrl) {
                setPhotoPreview(signedJson.signedUrl);
              } else {
                setPhotoPreview(null);
              }
            } catch (e) {
              setPhotoPreview(null);
            }
          } catch (e) {
            logError('Error subiendo foto de cliente:', e);
          }
        } else {
          const lib = await import('@/lib/supabase');
          const okSession = await lib.ensureValidSession();
          if (!okSession) throw new Error('session_invalid');
          const token = await lib.getAuthToken();
          if (!token) throw new Error('missing_token');

          const fnRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-account`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...payload, role: 'client' }),
            }
          );
          const fnJson = await fnRes.json().catch(() => null);
          if (!fnRes.ok || !fnJson || !fnJson.ok) {
            throw new Error(
              'failed_to_create_client: ' + (fnJson?.error || JSON.stringify(fnJson))
            );
          }
          const data =
            fnJson?.profile ||
            (Array.isArray(fnJson?.inserted) ? fnJson.inserted[0] : fnJson?.inserted) ||
            (Array.isArray(fnJson?.updated) ? fnJson.updated[0] : fnJson?.updated) ||
            fnJson;
          savedUser = data;
          savedUserId =
            savedUser && (savedUser.id || savedUser.user)
              ? savedUser.id || savedUser.user
              : typeof savedUser === 'string'
                ? savedUser
                : savedUser?.id || null;

          try {
            // Upload under profile folder so the saved photo_path matches the stored object
            const storagePath = `${savedUserId}/${filename}`;
            const { error: uploadErr } = await supabase.storage
              .from('profile_photos')
              .upload(storagePath, photoFile);
            if (uploadErr) throw uploadErr;

            const photoPathToStore = storagePath;
            const patchPhotoRes = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-client`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ profile_id: savedUserId, photo_path: photoPathToStore }),
              }
            );
            const patchPhotoJson = await patchPhotoRes.json().catch(() => null);
            if (!patchPhotoRes.ok || !patchPhotoJson || !patchPhotoJson.ok) {
              throw new Error(
                'failed_to_set_photo_path: ' +
                (patchPhotoJson?.error || JSON.stringify(patchPhotoJson))
              );
            }

            // Request server-side signed URL and use as preview to avoid unsigned GETs
            try {
              const fnUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/get-signed-url`;
              const signedRes = await fetch(fnUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ bucket: 'profile_photos', path: photoPathToStore, expires: 60 * 60 }),
              });
              const signedJson = await signedRes.json().catch(() => null);
              if (signedRes.ok && signedJson && signedJson.signedUrl) {
                setPhotoPreview(signedJson.signedUrl);
              } else {
                setPhotoPreview(null);
              }
            } catch (e) {
              setPhotoPreview(null);
            }
          } catch (e) {
            logError('Error subiendo foto de cliente:', e);
          }
        }
      } else {
        if (removePhoto && cliente?.id) payload.photo_path = null;

        if (cliente?.id) {
          const lib = await import('@/lib/supabase');
          const okSession = await lib.ensureValidSession();
          if (!okSession) throw new Error('session_invalid');
          const token = await lib.getAuthToken();
          if (!token) throw new Error('missing_token');

          const fnRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-client`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ profile_id: cliente.id, ...payload }),
            }
          );
          const fnJson = await fnRes.json().catch(() => null);
          if (!fnRes.ok || !fnJson || !fnJson.ok) {
            throw new Error(
              'failed_to_update_client: ' + (fnJson?.error || JSON.stringify(fnJson))
            );
          }
          const data = Array.isArray(fnJson.updated) ? fnJson.updated[0] : fnJson.updated;
          savedUser = data;
          savedUserId = cliente.id ?? savedUser?.id ?? savedUser?.user ?? null;
        } else {
          const lib = await import('@/lib/supabase');
          const okSession = await lib.ensureValidSession();
          if (!okSession) throw new Error('session_invalid');
          const token = await lib.getAuthToken();
          if (!token) throw new Error('missing_token');

          const fnRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-account`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...payload, role: 'client' }),
            }
          );
          const fnJson = await fnRes.json().catch(() => null);
          if (!fnRes.ok || !fnJson || !fnJson.ok) {
            throw new Error(
              'failed_to_create_client: ' + (fnJson?.error || JSON.stringify(fnJson))
            );
          }
          const data =
            fnJson?.profile ||
            (Array.isArray(fnJson?.inserted) ? fnJson.inserted[0] : fnJson?.inserted) ||
            (Array.isArray(fnJson?.updated) ? fnJson.updated[0] : fnJson?.updated) ||
            fnJson;
          savedUser = data;
          savedUserId =
            savedUser && (savedUser.id || savedUser.user)
              ? savedUser.id || savedUser.user
              : typeof savedUser === 'string'
                ? savedUser
                : savedUser?.id || null;
        }
      }

      const profileIdForPrograms =
        cliente?.id || savedUserId || savedUser?.id || savedUser?.user || null;
      if (profileIdForPrograms) {
        await clientProgramsApi.persistAll(profileIdForPrograms);
        clientProgramsApi.markCurrentAsClean();
        // clear event dirty and snapshot current form as persisted
        setHasEventDirty(false);
        initialFormRef.current = JSON.parse(
          JSON.stringify({
            ...(formData as any),
            birth_date: fechaNacimiento
              ? format(fechaNacimiento, 'yyyy-MM-dd')
              : (formData as any).birth_date,
          })
        );
      } else {
        logError('No se pudo resolver el ID de perfil para guardar los programas');
      }

      if (!cliente?.id) {
        try {
          const lib = await import('@/lib/supabase');
          const ok = await lib.ensureValidSession();
          if (ok) {
            const token = await lib.getAuthToken();
            if (!token) throw new Error('missing_token');
            const sendInvite = await import('@/lib/invites');
            const inviteKey = (savedUserId as string) || formData.email || '';
            if (!inviteKey) throw new Error('missing_profile_id_or_email');
            const { res, json } = await sendInvite.default(inviteKey);
            if (res.ok) {
              if (json?.note === 'no_email') {
                alert(
                  'Invitación creada, pero el perfil no tiene correo electrónico. No se pudo enviar el email de invitación.'
                );
              } else {
                const title = 'Invitación enviada al cliente';
                try {
                  localStorage.setItem(
                    'tactivo.inviteToast',
                    JSON.stringify({ title, durationMs: 2500 })
                  );
                } catch { }
                try {
                  window.dispatchEvent(
                    new CustomEvent('tactivo.invite', { detail: { title, durationMs: 2500 } })
                  );
                } catch { }
              }
            } else {
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
          } else {
            alert(
              'La sesión parece inválida o ha expirado. Por favor cierra sesión e inicia sesión de nuevo para reenviar la invitación.'
            );
          }
        } catch (e) {
          console.warn('Error calling send-invite function', e);
        }
      }

      try {
        localStorage.setItem('tactivo.currentView', 'clientes');
      } catch {
        // ignore
      }
      setRemovePhoto(false);
      navigate(`/${companyName}/panel`);
    } catch (err) {
      logError('Error al guardar cliente:', err);
      logError('Error completo:', JSON.stringify(err, null, 2));
      if ((err as any)?.response) {
        logError('Response data:', (err as any).response);
      }
      const msg = String((err as any)?.message || err || '');
      if (msg.includes('PGRST204') || msg.includes("Could not find the 'email' column")) {
        alert(
          'Error al guardar: parece haber un problema con la caché del esquema de PostgREST. Ve a Supabase Dashboard → Settings → API → Reload schema y prueba de nuevo.'
        );
      } else {
        alert(`Error al guardar el cliente: ${(err as any)?.message || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!cliente?.id) return;

    try {
      setLoading(true);
      const lib = await import('@/lib/supabase');
      const ok = await lib.ensureValidSession();
      if (!ok) {
        alert(
          'La sesión parece inválida o ha expirado. Por favor cierra sesión e inicia sesión de nuevo.'
        );
        return;
      }
      const api = await import('@/lib/supabase');
      const res = await api.deleteUserByProfileId(cliente.id!);
      if (!res || !res.ok) throw res?.data || res?.error || new Error('failed_to_delete_user');

      try {
        localStorage.setItem('tactivo.currentView', 'clientes');
      } catch {
        // ignore
      }
      setShowDeleteDialog(false);
      navigate(`/${companyName}/panel`);
    } catch (err: any) {
      logError('Error al eliminar cliente:', err);
      alert(`Error al eliminar el cliente: ${err?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Cliente, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === 'phone') {
      const phoneStr = String(value);
      if (phoneStr && !/^\d{9}$/.test(phoneStr)) {
        setPhoneError('Debe tener 9 dígitos');
      } else {
        setPhoneError('');
      }
    }

    if (field === 'email') {
      const emailStr = String(value || '').trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
      if (!emailStr || !valid) {
        setEmailError('Introduce un email válido');
      } else {
        setEmailError('');
      }
    }
  };

  const handleBack = () => {
    try {
      localStorage.setItem('tactivo.currentView', 'clientes');
    } catch {
      // ignore
    }
    navigate(`/${companyName}/panel`);
  };

  const handleViewChange = (view: ViewType) => {
    try {
      localStorage.setItem('tactivo.currentView', view);
    } catch {
      // ignore
    }
    if (isDirty) {
      setPendingNavigation({ type: 'view', view });
      setShowDiscardDialog(true);
      return;
    }
    setCurrentView(view);
    navigate(`/${companyName}/panel`);
  };

  if (loadingCliente) {
    return (
      <SidebarProvider defaultOpen={true}>
        <AppSidebar currentView={currentView} onViewChange={handleViewChange} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 justify-between">
            <h1 className="text-xl md:text-2xl font-bold">Cliente</h1>
          </header>
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Cargando cliente...</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar currentView={currentView} onViewChange={handleViewChange} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 justify-between">
          <h1 className="text-xl md:text-2xl font-bold">
            {cliente ? `${cliente.name} ${cliente.last_name}` : 'Crear Cliente'}
            {isDirty && (
              <Badge
                variant="outline"
                className="ml-3 bg-warning/10 text-muted-foreground border-warning px-1.5 py-[2px] text-xs"
              >
                Cambios no guardados
              </Badge>
            )}
          </h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 min-h-0 overflow-hidden min-w-0 pb-24">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <TabsList className="grid w-full max-w-md grid-cols-4 cliente-tabs">
              <TabsTrigger value="datos">Datos</TabsTrigger>
              <TabsTrigger value="bonos">Bonos</TabsTrigger>
              <TabsTrigger value="programas">Programas</TabsTrigger>
              <TabsTrigger value="historial" disabled={!cliente?.id}>
                Citas{cliente?.id ? ` (${eventos.length})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="datos" className="flex-1 min-h-0">
              <div className="mt-2 overflow-hidden pr-1 pb-20">
                <div className="h-full overflow-y-auto overflow-x-hidden rounded-lg border bg-card p-4 shadow-sm min-w-0">
                  <form id="cliente-form" onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nombre *</Label>
                          <Input
                            id="name"
                            value={formData.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            required
                            className="h-11"
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
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dni">DNI *</Label>
                          <Input
                            id="dni"
                            value={formData.dni || ''}
                            onChange={(e) => handleChange('dni', e.target.value)}
                            required
                            className="h-11"
                          />
                        </div>

                        {/* Foto: span 2 filas en desktop */}
                        <div className="space-y-2 row-span-2 flex flex-col items-start md:items-end w-full">
                          <Label
                            htmlFor="photo"
                            className="w-full text-left md:text-right pr-0 md:pr-6"
                          >
                            Foto
                          </Label>
                          <div className="w-full flex justify-start md:justify-end pr-0 md:pr-6">
                            <div>
                              <Input
                                id="photo"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setPhotoFile(file);
                                    setRemovePhoto(false);
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setPhotoPreview(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />

                              <div className="relative mt-0">
                                <label
                                  htmlFor="photo"
                                  className="w-32 h-32 rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground cursor-pointer"
                                >
                                  {photoPreview ? (
                                    <img
                                      src={photoPreview}
                                      alt="Preview"
                                      className="object-cover w-full h-full"
                                    />
                                  ) : (
                                    <span>Foto</span>
                                  )}
                                </label>

                                {/* Delete overlay */}
                                {(photoPreview ||
                                  photoFile ||
                                  (formData.photo && !removePhoto)) && (
                                    <ActionButton
                                      tooltip="Eliminar foto"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPhotoFile(null);
                                        setPhotoPreview(null);
                                        setRemovePhoto(true);
                                        setFormData((prev) => ({ ...prev, photo: '' }));
                                        const input = document.getElementById(
                                          'photo'
                                        ) as HTMLInputElement;
                                        if (input) input.value = '';
                                      }}
                                      className="absolute top-1 right-1 inline-flex items-center justify-center h-6 w-6 rounded-md bg-white shadow border border-border text-red-600 no-hover-color"
                                      aria-label="Eliminar foto"
                                    >
                                      <Trash className="h-3 w-3" />
                                    </ActionButton>
                                  )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Teléfono *</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone || ''}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className={`${phoneError ? 'border-red-500' : ''} h-11`}
                            required
                          />
                          {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
                        </div>

                        <div className="space-y-2 pt-2">
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor="email">Email *</Label>
                            {!cliente?.id && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">
                                    <p>Al crear el cliente, se enviará un correo de invitación a este email</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            disabled={!!cliente?.id}
                            readOnly={!!cliente?.id}
                            required
                            className="h-11 disabled:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <Label className="" htmlFor="address">
                            Dirección
                          </Label>
                          <Input
                            id="address"
                            value={formData.address || ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <div className="space-y-2 md:col-span-1">
                          <Label htmlFor="client-fecha">Fecha de Nacimiento</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                id="client-fecha"
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

                        <div className="space-y-2 md:col-span-1">
                          <Label htmlFor="client-age">Edad</Label>
                          <Input
                            id="client-age"
                            value={edad !== null ? `${edad} años` : ''}
                            disabled
                            className="bg-muted h-10"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <Label htmlFor="sport">Actividad Física</Label>
                          <Input
                            id="sport"
                            value={formData.sport || ''}
                            onChange={(e) => handleChange('sport', e.target.value)}
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <Label htmlFor="occupation">Ocupación</Label>
                          <Input
                            id="occupation"
                            value={formData.occupation || ''}
                            onChange={(e) => handleChange('occupation', e.target.value)}
                            className="h-11"
                          />
                        </div>
                      </div>

                      <Collapsible className="rounded-lg border">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-4 h-auto rounded-none hover:bg-muted/50"
                            type="button"
                          >
                            <span className="font-semibold">Información Adicional</span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t bg-muted/30 p-4 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="history">Antecedentes</Label>
                              <LazyRichTextEditor
                                id="history"
                                value={formData.history || ''}
                                onChange={(value) => handleChange('history', value)}
                              />
                              <input type="hidden" name="history" value={formData.history || ''} />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="diagnosis">Diagnóstico</Label>
                              <LazyRichTextEditor
                                id="diagnosis"
                                value={formData.diagnosis || ''}
                                onChange={(value) => handleChange('diagnosis', value)}
                              />
                              <input type="hidden" name="diagnosis" value={formData.diagnosis || ''} />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="allergies">Alergias</Label>
                              <LazyRichTextEditor
                                id="allergies"
                                value={formData.allergies || ''}
                                onChange={(value) => handleChange('allergies', value)}
                              />
                              <input type="hidden" name="allergies" value={formData.allergies || ''} />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="client-notes">Notas</Label>
                              <LazyRichTextEditor
                                id="client-notes-editor"
                                value={formData.notes || ''}
                                onChange={(value) => handleChange('notes', value)}
                              />
                              <textarea id="client-notes" name="notes" value={formData.notes || ''} readOnly className="sr-only" />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </form>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bonos" className="flex-1 min-h-0 mt-4 overflow-hidden px-0">
              <div className="mt-2 overflow-hidden pr-0">
                <div className="grid w-full gap-6 rounded-lg border bg-card p-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="session_credits">Sesiones</Label>
                      <Input
                        id="session_credits"
                        type="text"
                        value={String(formData.session_credits ?? '')}
                        onChange={(e) => handleChange('session_credits', e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="class_credits">Clases</Label>
                      <Input
                        id="class_credits"
                        type="text"
                        value={String(formData.class_credits ?? '')}
                        onChange={(e) => handleChange('class_credits', e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="programas" className="flex-1 min-h-0">
              <div className="mt-2 overflow-hidden pr-1 pb-20">
                {/* Reserve space for fixed footer (pb-20 matches footer height) */}
                <div className="h-full overflow-y-auto overflow-x-hidden rounded-lg border bg-card p-2 shadow-sm min-w-0">
                  <ClientPrograms api={clientProgramsApi} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historial" className="flex-1 min-h-0">
              <div className="mt-2 overflow-hidden pr-1">
                <div className="h-full overflow-y-auto rounded-lg border bg-card p-4 shadow-sm">
                  {loadingEventos ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-muted-foreground">Cargando historial...</p>
                    </div>
                  ) : eventos.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-muted-foreground">No hay citas registradas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {eventos.map((evento) => {
                        const fecha = evento.datetime ? parseDatetime(evento.datetime) : null;
                        let profesionalNames = 'Sin asignar';
                        if (Array.isArray(evento.expand?.professional) && evento.expand.professional.length) {
                          profesionalNames = evento.expand.professional
                            .map((p: any) => `${p.name} ${p.last_name}`)
                            .join(', ');
                        } else if (evento.expand?.professional) {
                          profesionalNames = `${(evento.expand.professional as any).name} ${(evento.expand.professional as any).last_name}`;
                        } else {
                          // fallback to localProfilesMap using the raw professional id(s)
                          const pros = Array.isArray(evento.professional)
                            ? evento.professional
                            : evento.professional
                              ? [evento.professional]
                              : [];
                          if (pros.length > 0) {
                            const p = localProfilesMap[pros[0]];
                            if (p) profesionalNames = `${p.name} ${p.last_name}`;
                          }
                        }

                        return (
                          <Card
                            key={evento.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleEditEvent(evento.id!)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleEditEvent(evento.id!);
                              }
                            }}
                            className="p-4 cursor-pointer"
                          >
                            <div className="grid sm:grid-cols-12 cliente-citas-grid gap-0 sm:gap-4 items-center">
                              <div className="flex items-center gap-1 sm:gap-3 mr-0 sm:mr-8 col-span-1 sm:col-span-2 min-w-0 w-auto sm:w-[120px] flex-shrink-0 pr-8 sm:pr-1">
                                <CalendarIcon className="hidden sm:inline-block h-4 w-4 text-muted-foreground" />
                                <div>
                                  {fecha && !Number.isNaN(fecha.getTime()) ? (
                                    <>
                                      <p className="text-sm">{format(fecha, 'dd/MM/yyyy')}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {format(fecha, 'HH:mm')}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Sin fecha</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 col-span-1 sm:col-span-6 min-w-0">
                                {(() => {
                                  let profObj =
                                    Array.isArray(evento.expand?.professional) && evento.expand.professional.length
                                      ? evento.expand.professional[0]
                                      : evento.expand?.professional || null;
                                  // fallback to localProfilesMap if expand missing
                                  if (!profObj) {
                                    const pros = Array.isArray(evento.professional)
                                      ? evento.professional
                                      : evento.professional
                                        ? [evento.professional]
                                        : [];
                                    if (pros.length > 0) {
                                      const p = localProfilesMap[pros[0]];
                                      if (p) profObj = p;
                                    }
                                  }
                                  const profPhoto =
                                    profObj?.photoUrl ||
                                    ((profObj?.user || profObj?.id) && profObj?.photo_path
                                      ? getFilePublicUrl('profile_photos', profObj.user || profObj.id, profObj.photo_path)
                                      : null);

                                  let first = '';
                                  let last = '';
                                  if (profObj) {
                                    first = profObj.name || '';
                                    last = profObj.last_name || '';
                                  } else if (profesionalNames) {
                                    const parts = String(profesionalNames).trim().split(' ');
                                    if (parts.length > 1) {
                                      last = parts.pop() as string;
                                      first = parts.join(' ');
                                    } else {
                                      first = profesionalNames;
                                    }
                                  }

                                  const fullName = `${first}${last ? ' ' + last : ''}`.trim();

                                  return (
                                    <>

                                      {profPhoto ? (
                                        <img
                                          src={profPhoto}
                                          alt={fullName}
                                          className="h-6 w-6 sm:h-7 sm:w-7 rounded object-cover flex-shrink-0 mr-1 sm:mr-2"
                                        />
                                      ) : (
                                        <div className="h-6 w-6 sm:h-7 sm:w-7 rounded bg-muted flex items-center justify-center flex-shrink-0 mr-1 sm:mr-2">
                                          <User className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                      )}

                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm text-foreground leading-tight">
                                          <span className="block truncate">{first || profesionalNames || 'Sin asignar'}</span>
                                          {last ? (
                                            <span className="block text-sm text-foreground truncate">{last}</span>
                                          ) : null}
                                        </p>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>

                              <div className="flex items-center gap-0 mr-0 sm:mr-0 pr-3 sm:pr-0 justify-start sm:justify-start col-span-1 sm:col-span-2 w-auto sm:w-[48px] flex-shrink-0">
                                <p className="text-sm font-medium">{evento.cost || 0}€</p>
                              </div>

                              <div className="flex items-center gap-1 pl-1 sm:pl-0 justify-start sm:justify-start col-span-1 sm:col-span-2 w-auto sm:w-[72px] flex-shrink-0 ml-0">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span aria-label={evento.paid ? 'Pagada' : 'No pagada'} className={evento.paid ? 'text-green-600 inline-flex items-center whitespace-nowrap' : 'text-red-600 inline-flex items-center whitespace-nowrap'}>
                                        {evento.paid ? (
                                          <CheckCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                                        ) : (
                                          <XCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                                        )}
                                        {/* Show text on desktop, hide on mobile */}
                                        <span className="hidden sm:inline ml-1 text-sm">{evento.paid ? 'Pagada' : 'No pagada'}</span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-2 py-1 text-sm cursor-default">
                                      {evento.paid ? 'Pagada' : 'No pagada'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              {/* Edit action moved to row click - removed icon button for clarity on mobile */}
                              <div className="hidden" />
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 md:left-[var(--sidebar-width)] md:px-6 z-50">
          <div className="flex items-center justify-between w-full gap-3">
            <div>
              {cliente?.id && activeTab === 'datos' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={loading}
                >
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isDirty) {
                    setPendingNavigation({ type: 'back' });
                    setShowDiscardDialog(true);
                  } else {
                    clientProgramsApi.resetToInitial();
                    handleBack();
                  }
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={(e) => {
                  if (isNewCliente) {
                    setShowCreateConfirm(true);
                  } else {
                    handleSubmit(e as any);
                  }
                }}
                disabled={isSaveDisabled}
              >
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
          </div>
        </div>

        <EventDialog
          open={eventDialogOpen}
          onOpenChange={(open) => setEventDialogOpen(open)}
          event={selectedEvent}
          onSave={handleEventSaved}
        />

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmation dialog when creating a new client */}
        <AlertDialog open={showCreateConfirm} onOpenChange={setShowCreateConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Crear Cliente</AlertDialogTitle>
              <AlertDialogDescription>
                Al crear un cliente, se le enviará un correo para que tenga acceso a Tactivo. Desde su login de cliente podrá ver sus eventos y programas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowCreateConfirm(false);
                  handleSubmit();
                }}
              >
                Crear Cliente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={showDiscardDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowDiscardDialog(false);
              setPendingNavigation(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cambios no guardados</AlertDialogTitle>
              <AlertDialogDescription>¿Descartar cambios no guardados?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  // Discard changes and perform pending navigation (if any)
                  revertChanges();
                  setShowDiscardDialog(false);
                  const nav = pendingNavigation;
                  setPendingNavigation(null);
                  if (nav?.type === 'back') {
                    handleBack();
                  } else if (nav?.type === 'view') {
                    try {
                      localStorage.setItem('tactivo.currentView', nav.view!);
                    } catch { }
                    setCurrentView(nav.view!);
                    navigate(`/${companyName}/panel`);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Descartar cambios
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
