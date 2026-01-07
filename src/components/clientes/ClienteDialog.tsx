import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
    CalendarIcon,
    ChevronDown,
    UserPlus,
    PencilLine,
    User,
    Euro,
    CheckCircle,
    XCircle,
    Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFilePublicUrl, supabase } from '@/lib/supabase';
import useResolvedFileUrl from '@/hooks/useResolvedFileUrl';
import { getProfilesByIds } from '@/lib/profiles';
import InviteToast from '@/components/InviteToast';
import ClientPrograms from '@/components/clientes/ClientPrograms';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
import type { Cliente } from '@/types/cliente';
import type { Event } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';
import { EventDialog } from '@/components/eventos/EventDialog';

interface ClienteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cliente?: Cliente | null;
    onSave: () => void;
    initialTab?: 'datos' | 'programas';
}

export function ClienteDialog({ open, onOpenChange, cliente, onSave, initialTab }: ClienteDialogProps) {

    const { companyId } = useAuth();
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
    const [eventos, setEventos] = useState<Event[]>([]);
    const [loadingEventos, setLoadingEventos] = useState(false);
    const [eventDialogOpen, setEventDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [activeTab, setActiveTab] = useState('datos');

    // If the parent requests a specific tab when opening, apply it when the dialog is shown
    useEffect(() => {
        if (open) {
            setActiveTab(initialTab ?? 'datos');
        }
    }, [open, initialTab]);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showInviteToast, setShowInviteToast] = useState(false);
    const [inviteToastTitle, setInviteToastTitle] = useState<string | null>(null);

    // Resolve existing customer photo URL (public or signed)
    const resolvedClientePhoto = useResolvedFileUrl(
        'profile_photos',
        cliente?.id || null,
        cliente?.photo_path || null
    );

    // Helper function to calculate age
    const calcularEdad = useCallback((fecha: Date) => {
        const hoy = new Date();
        let edad = hoy.getFullYear() - fecha.getFullYear();
        const mes = hoy.getMonth() - fecha.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
            edad--;
        }
        setEdad(edad);
    }, []);

    // Load events for the client
    const loadEventos = useCallback(async (clienteId: string) => {
        if (!clienteId) return;

        setLoadingEventos(true);
        try {
            // Resolve profile row for the given clienteId (could be user id or profile id)
            let resolvedProfileId: string | null = null;
            let resolvedUserId: string | null = null;
            try {
                const { data: profRows, error: profErr } = await supabase.rpc('get_profiles_by_ids_for_clients', { p_ids: [clienteId], p_company: companyId });
                if (!profErr && profRows && (profRows as any[]).length > 0) {
                    const row = (profRows as any[])[0];
                    resolvedProfileId = row.id ?? null;
                    resolvedUserId = row.user ?? null;
                } else {
                    // Fallback: try selecting the profile row directly (may succeed if RPC is restricted)
                    try {
                        const { data: profileRow, error: selectErr } = await supabase.from('profiles').select('id, user').eq('id', clienteId).limit(1).maybeSingle();
                        if (!selectErr && profileRow) {
                            resolvedProfileId = profileRow.id ?? null;
                            resolvedUserId = profileRow.user ?? null;
                        }
                    } catch {
                        // ignore
                    }
                }
            } catch {
                // ignore resolution errors, we'll fallback to simple matching
            }

            const { data: rpcRecords, error } = await supabase.rpc('get_events_for_company', {
                p_company: companyId,
            });
            if (error) throw error;
            const recordsAll = Array.isArray(rpcRecords) ? rpcRecords : rpcRecords ? [rpcRecords] : [];

            // (removed debug logging)

            // helper to check client membership supporting either profile id or user id stored in event.client
            // Normalize values to strings to avoid mismatches between numeric/uuid/string storage in events.client
            const clientMatches = (clientsField: any, pid: string, resolvedProfile: string | null, resolvedUser: string | null) => {
                const arr = Array.isArray(clientsField) ? clientsField : (clientsField ? [clientsField] : []);
                if (!arr || arr.length === 0) return false;
                const normalized = arr.map((x: any) => String(x));
                const pidStr = String(pid);
                if (normalized.includes(pidStr)) return true;
                if (resolvedProfile && normalized.includes(String(resolvedProfile))) return true;
                if (resolvedUser && normalized.includes(String(resolvedUser))) return true;
                return false;
            };

            const records = (recordsAll || []).filter((r: any) => {
                // Some RPC rows may use different fields/names for client lists (client, client_user_ids, clientUserIds, etc.) — try all common ones
                const clientsField = r.client ?? r.client_user_ids ?? r.clientUserIds ?? r.clients ?? r.clientIds ?? null;
                return clientMatches(clientsField, clienteId, resolvedProfileId, resolvedUserId) && r.type === 'appointment';
            });

            // Enrich professional field
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
            const sorted = (enriched || []).slice().sort((a: any, b: any) => (new Date(b.datetime).getTime() || 0) - (new Date(a.datetime).getTime() || 0));
            setEventos(sorted);
        } catch (err) {
            logError('Error al cargar eventos:', err);
        } finally {
            setLoadingEventos(false);
        }
    }, [companyId]);

    const ensureAuthoritativeEmail = useCallback(async (clienteId?: string) => {
        if (!clienteId) return;
        try {
            if (!cliente?.email) {
                const api = await import('@/lib/supabase');
                const profile = await api.fetchProfileByUserId(clienteId);
                if (profile?.email) setFormData((prev) => ({ ...prev, email: profile.email || prev.email }));
            }
        } catch (err) {
            logError('Error fetching authoritative email for client', err);
        }
    }, [cliente]);

    useEffect(() => {
        if (cliente) {
            setFormData((prev) => ({
                ...prev,
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
            }));
            if (cliente.birth_date) {
                const date = new Date(cliente.birth_date);
                setFechaNacimiento(date);
                calcularEdad(date);
            }

            // Cargar events y asegurar email actualizado
            ensureAuthoritativeEmail(cliente.id!);

            loadEventos(cliente.id!);
        } else {
            resetFormData();
        }
        setPhoneError('');

        // Autofocus removed per UX decision
    }, [cliente, open, ensureAuthoritativeEmail, loadEventos]);

    // Update photo preview when the resolved URL or the selected file changes (without touching formData)
    useEffect(() => {
        if (cliente?.photo_path) {
            if (!photoFile) setPhotoPreview(resolvedClientePhoto || null);
        } else {
            setPhotoPreview(null);
        }
    }, [resolvedClientePhoto, photoFile, cliente?.photo_path]);

    const resetFormData = () => {
        setFormData({
            name: '',
            last_name: '',
            dni: '',
            email: '',
            phone: '',
            company: '',
            session_credits: 0,
            class_credits: 0,
        });
        setFechaNacimiento(undefined);
        setEdad(null);
        setPhotoFile(null);
        setPhotoPreview(null);
        setRemovePhoto(false);
        setEventos([]);
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

    const handleEventSaved = () => {
        loadEventos(cliente?.id!);
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

        // Validar teléfono
        if (formData.phone && !/^\d{9}$/.test(formData.phone)) {
            setPhoneError('El teléfono debe tener exactamente 9 dígitos');
            return;
        }

        setLoading(true);

        try {
            // Build payload object for non-file updates
            const payload: any = {};

            // Añadir campos regulares (excluyendo campos especiales y metadata)
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
                if (value !== undefined && value !== null && value !== '') {
                    if (key === 'session_credits' || key === 'class_credits') {
                        const parsed = parseInt(String(value));
                        payload[key] = String(isNaN(parsed) ? 0 : parsed);
                    } else {
                        payload[key] = String(value);
                    }
                }
            });

            // Email handling
            if (!cliente?.id) {
                if (formData.email) {
                    payload.email = formData.email;
                }
            } else if (formData.email && formData.email !== cliente.email) {
                payload.email = formData.email;
                payload.emailVisibility = 'true';
            }

            // Fecha nacimiento
            if (fechaNacimiento) payload.birth_date = format(fechaNacimiento, 'yyyy-MM-dd');

            // Role/company for new client (do NOT include passwords in profiles table)
            // The invite function will ensure an auth user is created and the recovery email is sent.
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
                const filename = `${Date.now()}-${(crypto as any)?.randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2, 10)}${ext}`;

                if (cliente?.id) {
                    // Update profile via Edge Function to avoid RLS
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
                        const storagePath = `${filename}`;
                        const { data: uploadData, error: uploadErr } = await supabase.storage
                            .from('profile_photos')
                            .upload(storagePath, photoFile);
                        if (uploadErr) {
                            logError('Upload error for cliente', {
                                bucket: 'profile_photos',
                                path: storagePath,
                                error: uploadErr,
                            });
                            throw uploadErr;
                        }
                        console.debug('Upload success for cliente', {
                            bucket: 'profile_photos',
                            path: storagePath,
                            data: uploadData,
                        });

                        // Attempt to set photo_path and verify via Edge Function to avoid RLS
                        const patchPhotoRes = await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-client`,
                            {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ profile_id: savedUserId, photo_path: filename }),
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
                        if (!verified || verified.photo_path !== filename)
                            throw new Error('photo_path no persistió para el cliente');

                        // Update preview to resolved public/signed URL (prefer root filename)
                        setPhotoPreview(
                            getFilePublicUrl('profile_photos', null, filename) ||
                            getFilePublicUrl('profile_photos', savedUserId, filename) ||
                            null
                        );
                    } catch (e) {
                        logError('Error subiendo foto de cliente:', e);
                    }
                } else {
                    // Create profile first via Edge Function to avoid RLS restrictions
                    const lib = await import('@/lib/supabase');
                    const okSession = await lib.ensureValidSession();
                    if (!okSession) throw new Error('session_invalid');
                    const token = await lib.getAuthToken();
                    if (!token) throw new Error('missing_token');

                    const fnRes = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-client`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify(payload),
                        }
                    );
                    const fnJson = await fnRes.json().catch(() => null);
                    if (!fnRes.ok || !fnJson || !fnJson.ok) {
                        throw new Error(
                            'failed_to_create_client: ' + (fnJson?.error || JSON.stringify(fnJson))
                        );
                    }
                    const data = Array.isArray(fnJson.inserted) ? fnJson.inserted[0] : fnJson.inserted;
                    savedUser = data;

                    savedUserId =
                        savedUser && (savedUser.id || savedUser.user)
                            ? savedUser.id || savedUser.user
                            : savedUser?.id || null;

                    try {
                        const storagePath = `${filename}`;
                        const { data: uploadData, error: uploadErr } = await supabase.storage
                            .from('profile_photos')
                            .upload(storagePath, photoFile);
                        if (uploadErr) throw uploadErr;
                        console.debug('Upload success for cliente', {
                            bucket: 'profile_photos',
                            path: storagePath,
                            data: uploadData,
                        });
                        if (uploadErr) throw uploadErr;

                        const patchPhotoRes = await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/update-client`,
                            {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ profile_id: savedUserId, photo_path: filename }),
                            }
                        );
                        const patchPhotoJson = await patchPhotoRes.json().catch(() => null);
                        if (!patchPhotoRes.ok || !patchPhotoJson || !patchPhotoJson.ok) {
                            throw new Error(
                                'failed_to_set_photo_path: ' +
                                (patchPhotoJson?.error || JSON.stringify(patchPhotoJson))
                            );
                        }
                        // Update preview to resolved public/signed URL (prefer root filename)
                        setPhotoPreview(
                            getFilePublicUrl('profile_photos', null, filename) ||
                            getFilePublicUrl('profile_photos', savedUserId, filename) ||
                            null
                        );
                    } catch (e) {
                        logError('Error subiendo foto de cliente:', e);
                    }
                }
            } else {
                // No new file
                if (removePhoto && cliente?.id) payload.photo_path = null;

                if (cliente?.id) {
                    // Update via Edge Function to avoid RLS
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
                } else {
                    // Use Edge Function to create client to bypass RLS (service role)
                    const lib = await import('@/lib/supabase');
                    const okSession = await lib.ensureValidSession();
                    if (!okSession) throw new Error('session_invalid');
                    const token = await lib.getAuthToken();
                    if (!token) throw new Error('missing_token');

                    const fnRes = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-client`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify(payload),
                        }
                    );
                    const fnJson = await fnRes.json().catch(() => null);
                    if (!fnRes.ok || !fnJson || !fnJson.ok) {
                        throw new Error(
                            'failed_to_create_client: ' + (fnJson?.error || JSON.stringify(fnJson))
                        );
                    }
                    const data = Array.isArray(fnJson.inserted) ? fnJson.inserted[0] : fnJson.inserted;
                    savedUser = data;
                }
            }

            // If we just created a new cliente, request the send-invite function (mirror profesional flow)
            if (!cliente?.id) {
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
                                const sendInvite = await import('@/lib/invites');
                                const inviteKey = (savedUserId as string) || formData.email || '';
                                if (!inviteKey) throw new Error('missing_profile_id_or_email');
                                const { res, json } = await sendInvite.default(inviteKey);
                                if (res.ok) {
                                    if (json?.note === 'no_email') {
                                        alert('Invitación creada, pero el perfil no tiene correo electrónico. No se pudo enviar el email de invitación.');
                                    } else {
                                        setInviteToastTitle('Invitación enviada al cliente');
                                        setShowInviteToast(true);
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
                            } catch (e) {
                                console.warn('Error calling send-invite helper', e);
                                alert('Error llamando a la función de envío: ' + (((e as any)?.message) || String(e)));
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error calling send-invite function', e);
                }
            }



            onSave();
            onOpenChange(false);
            setRemovePhoto(false);
        } catch (err) {
            logError('Error al guardar cliente:', err);
            logError('Error completo:', JSON.stringify(err, null, 2));
            if ((err as any)?.response) {
                logError('Response data:', (err as any).response);
            }
            const msg = String(((err as any)?.message) || err || '');
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
            // Ensure session is valid and attempt refresh if needed
            const lib = await import('@/lib/supabase');
            const ok = await lib.ensureValidSession();
            if (!ok) {
                alert(
                    'La sesión parece inválida o ha expirado. Por favor cierra sesión e inicia sesión de nuevo.'
                );
                return;
            }
            // Request server-side deletion: removes both the profile row and the linked auth user (service role) if present.
            const api = await import('@/lib/supabase');
            const res = await api.deleteUserByProfileId(cliente.id!);
            if (!res || !res.ok) throw res?.data || res?.error || new Error('failed_to_delete_user');

            onSave();
            onOpenChange(false);
            setShowDeleteDialog(false);
        } catch (err: any) {
            logError('Error al eliminar cliente:', err);
            alert(`Error al eliminar el cliente: ${err?.message || 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof Cliente, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Validar teléfono en tiempo real
        if (field === 'phone') {
            const phoneStr = String(value);
            if (phoneStr && !/^\d{9}$/.test(phoneStr)) {
                setPhoneError('Debe tener 9 dígitos');
            } else {
                setPhoneError('');
            }
        }
    };



    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className={cn('h-[90vh] flex flex-col overflow-hidden', activeTab === 'programas' ? 'max-w-[95vw] w-[95vw]' : 'max-w-3xl')}>
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            {cliente ? <PencilLine className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                            <DialogTitle>{cliente ? 'Editar Cliente' : 'Crear Cliente'}</DialogTitle>
                        </div>
                        <DialogDescription>
                            {cliente ? 'Modifica los datos del cliente' : 'Completa los datos del nuevo cliente'}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="flex-1 flex flex-col overflow-hidden min-h-0"
                    >
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="datos">Datos</TabsTrigger>
                            <TabsTrigger value="historial" disabled={!cliente?.id}>
                                Citas{cliente?.id ? ` (${eventos.length})` : ''}
                            </TabsTrigger>
                            <TabsTrigger value="programas">Programas</TabsTrigger>
                        </TabsList>

                        <TabsContent value="datos" className="flex-1 min-h-0 mt-4 overflow-hidden">
                            <div className="h-full overflow-y-auto pr-2">
                                <form id="cliente-form" onSubmit={handleSubmit} className="space-y-6 px-1">
                                    {/* Campos Obligatorios */}
                                    <div className="space-y-4">
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
                                                    className={phoneError ? 'border-red-500' : ''}
                                                    required
                                                />
                                                {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email *</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={formData.email || ''}
                                                    onChange={(e) => handleChange('email', e.target.value)}
                                                    disabled={!!cliente?.id}
                                                    readOnly={!!cliente?.id}
                                                    required
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="session_credits">Sesiones *</Label>
                                                    <Input
                                                        id="session_credits"
                                                        type="text"
                                                        value={String(formData.session_credits ?? '')}
                                                        onChange={(e) => handleChange('session_credits', e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="class_credits">Clases *</Label>
                                                    <Input
                                                        id="class_credits"
                                                        type="text"
                                                        value={String(formData.class_credits ?? '')}
                                                        onChange={(e) => handleChange('class_credits', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Campos Opcionales */}
                                    <div className="space-y-4 pt-4 border-t">
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
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setPhotoFile(file);
                                                                    setRemovePhoto(false);
                                                                    // Crear preview
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setPhotoPreview(reader.result as string);
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
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
                                                                        // Reset file input
                                                                        const input = document.getElementById(
                                                                            'photo'
                                                                        ) as HTMLInputElement;
                                                                        if (input) input.value = '';
                                                                    }}
                                                                    className="ml-2 text-foreground hover:text-destructive text-lg font-semibold"
                                                                >
                                                                    ×
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
                                        </div>

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

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="occupation">Ocupación</Label>
                                                <Input
                                                    id="occupation"
                                                    value={formData.occupation || ''}
                                                    onChange={(e) => handleChange('occupation', e.target.value)}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="sport">Actividad Física</Label>
                                                <Input
                                                    id="sport"
                                                    value={formData.sport || ''}
                                                    onChange={(e) => handleChange('sport', e.target.value)}
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
                                                        <Label>Antecedentes</Label>
                                                        <LazyRichTextEditor
                                                            value={formData.history || ''}
                                                            onChange={(value) => handleChange('history', value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Diagnóstico</Label>
                                                        <LazyRichTextEditor
                                                            value={formData.diagnosis || ''}
                                                            onChange={(value) => handleChange('diagnosis', value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Alergias</Label>
                                                        <LazyRichTextEditor
                                                            value={formData.allergies || ''}
                                                            onChange={(value) => handleChange('allergies', value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Notas</Label>
                                                        <LazyRichTextEditor
                                                            value={formData.notes || ''}
                                                            onChange={(value) => handleChange('notes', value)}
                                                        />
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </div>
                                </form>
                            </div>
                        </TabsContent>
                        <TabsContent value="programas" className="flex-1 min-h-0 mt-4 overflow-hidden">
                            <div className="h-full overflow-y-auto">
                                <ClientPrograms cliente={cliente} companyId={companyId || ''} />
                            </div>
                        </TabsContent>
                        <TabsContent value="historial" className="flex-1 min-h-0 mt-4 overflow-hidden">
                            <div className="h-full overflow-y-auto px-1">
                                {loadingEventos ? (
                                    <div className="flex items-center justify-center py-8">
                                        <p className="text-muted-foreground">Cargando historial...</p>
                                    </div>
                                ) : eventos.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                        <p className="text-muted-foreground">No hay citas registradas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 py-4">
                                        {eventos.map((evento) => {
                                            const fecha = new Date(evento.datetime);
                                            const profesionalNames = Array.isArray(evento.expand?.professional)
                                                ? evento.expand.professional
                                                    .map((p: any) => `${p.name} ${p.last_name}`)
                                                    .join(', ')
                                                : evento.expand?.professional
                                                    ? `${(evento.expand.professional as any).name} ${(evento.expand.professional as any).last_name}`
                                                    : 'Sin asignar';

                                            return (
                                                <Card key={evento.id} className="p-4">
                                                    <div className="grid grid-cols-6 gap-4 items-center">
                                                        <div className="flex items-center gap-2">
                                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                            <div>
                                                                <p className="text-sm">{format(fecha, 'dd/MM/yyyy')}</p>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {format(fecha, 'HH:mm')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 col-span-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <p className="text-sm">{profesionalNames}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Euro className="h-4 w-4 text-muted-foreground" />
                                                            <p className="text-sm font-medium">{evento.cost || 0}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {evento.paid ? (
                                                                <div className="flex items-center gap-1 text-green-600">
                                                                    <CheckCircle className="h-4 w-4" />
                                                                    <span className="text-sm">Pagada</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-red-600">
                                                                    <XCircle className="h-4 w-4" />
                                                                    <span className="text-sm">No pagada</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEditEvent(evento.id!)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="mt-4">
                        <div className="flex w-full justify-between">
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
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" form="cliente-form" disabled={loading}>
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {showInviteToast && inviteToastTitle && (
                <InviteToast title={inviteToastTitle} durationMs={2500} onClose={() => setShowInviteToast(false)} />
            )}

        </>
    );
}
