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
import { Checkbox } from '@/components/ui/checkbox';
import { debug, error as logError } from '@/lib/logger';
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
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import LazyRichTextEditor from '@/components/ui/LazyRichTextEditor';
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
    Plus,
    GripVertical,
    ArrowUp,
    ArrowDown,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getFilePublicUrl, supabase } from '@/lib/supabase';
import useResolvedFileUrl from '@/hooks/useResolvedFileUrl';
import { getProfilesByIds } from '@/lib/profiles';
import InviteToast from '@/components/InviteToast';
import ActionButton from '@/components/ui/ActionButton';
import ExerciseDialog from '@/components/ejercicios/ExerciseDialog';
import { ExerciseBadgeGroup } from '@/components/ejercicios/ExerciseBadgeGroup';
import { Trash } from 'lucide-react';
import ProgramExerciseDialog from '@/components/programs/ProgramExerciseDialog';
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
    // Debug: ensure open prop flows from parent (use logger)
    if (typeof window !== 'undefined') {
        debug('[ClienteDialog] render', { open, clienteId: cliente?.id });
    }
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

    // Programs state (persisted and temporary)
    const [programs, setPrograms] = useState<Array<any>>([]);
    const [activeProgramId, setActiveProgramId] = useState<string>('');
    const [loadingProgramsList, setLoadingProgramsList] = useState(false);
    // Inline edit state for program names
    const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
    const [editingProgramName, setEditingProgramName] = useState<string>('');

    // Exercises / program-exercises picker state
    interface ExerciseItem { id: string; name: string; description?: string; }
    const [showAddExercisesDialog, setShowAddExercisesDialog] = useState(false);
    const [exercisesForCompany, setExercisesForCompany] = useState<ExerciseItem[]>([]);
    const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
    const [exercisesLoading, setExercisesLoading] = useState(false);
    const [addingExercisesLoading, setAddingExercisesLoading] = useState(false);
    const [currentProgramForPicker, setCurrentProgramForPicker] = useState<string | null>(null);
    const [currentDayForPicker, setCurrentDayForPicker] = useState<string | null>(null);
    const [editingProgramExercise, setEditingProgramExercise] = useState<any | null>(null);
    const [showEditProgramExerciseDialog, setShowEditProgramExerciseDialog] = useState(false);
    const [dragOver, setDragOver] = useState<{ programId?: string; day?: string } | null>(null);

    const handleDragStart = (ev: React.DragEvent, programId: string, peId: string) => {
        ev.dataTransfer?.setData('text', JSON.stringify({ programId, peId }));
        setDragOver({ programId });
        document.body.classList.add('pe-dragging');
    };
    const handleDragEnd = () => {
        setDragOver(null);
        document.body.classList.remove('pe-dragging');
    };
    const handleDragOverColumn = (ev: React.DragEvent, programId: string, day: string) => {
        ev.preventDefault();
        setDragOver({ programId, day });
    };

    // Save state for current program
    const [savingProgram, setSavingProgram] = useState(false);
    useEffect(() => {
        if (programs.length > 0 && !programs.find((p) => (p.id ?? p.tempId) === activeProgramId)) {
            const first = programs[0];
            setActiveProgramId(first.id ?? first.tempId);
        }
    }, [programs, activeProgramId]);

    useEffect(() => {
        // Initialize programs when dialog opens
        if (open) {
            if (cliente?.id) {
                loadPrograms();
            } else {
                // For new clients, ensure a default program exists locally
                if (programs.length === 0) {
                    const tempId = `t-${Date.now()}`;
                    setPrograms([{ tempId, name: 'Programa 1', persisted: false, description: '', programExercises: [], days: ['A'] }]);
                    setActiveProgramId(tempId);
                }
            }
        }
    }, [open, cliente?.id]);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showDeleteProgramDialog, setShowDeleteProgramDialog] = useState(false);
    const [programToDeleteId, setProgramToDeleteId] = useState<string | null>(null);
    const [showInviteToast, setShowInviteToast] = useState(false);
    const [inviteToastTitle, setInviteToastTitle] = useState<string | null>(null);

    // Resolve existing customer photo URL (public or signed)
    const resolvedClientePhoto = useResolvedFileUrl(
        'profile_photos',
        cliente?.id || null,
        cliente?.photo_path || null
    );

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
            // Try to load authoritative email from profiles table if missing (use helper to avoid malformed OR queries)
            (async () => {
                try {
                    if (!cliente.email) {
                        const api = await import('@/lib/supabase');
                        const profile = await api.fetchProfileByUserId(cliente.id!);
                        if (profile?.email) setFormData((prev) => ({ ...prev, email: profile.email || prev.email }));
                    }
                } catch {
                    /* ignore */
                }
            })();

            loadEventos(cliente.id!);
        } else {
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
        }
        setPhoneError('');

        // Autofocus removed per UX decision
    }, [cliente, open]);

    // Update photo preview when the resolved URL or the selected file changes (without touching formData)
    useEffect(() => {
        if (cliente?.photo_path) {
            if (!photoFile) setPhotoPreview(resolvedClientePhoto || null);
        } else {
            setPhotoPreview(null);
        }
    }, [resolvedClientePhoto, photoFile, cliente?.photo_path]);

    const calcularEdad = (fecha: Date) => {
        const hoy = new Date();
        let edad = hoy.getFullYear() - fecha.getFullYear();
        const mes = hoy.getMonth() - fecha.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
            edad--;
        }
        setEdad(edad);
    };

    const loadEventos = async (clienteId: string) => {
        if (!clienteId) return;

        setLoadingEventos(true);
        try {
            // Resolve profile row for the given clienteId (could be user id or profile id)
            let resolvedProfileId: string | null = null;
            let resolvedUserId: string | null = null;
            try {
                const { data: profRows, error: profErr } = await supabase.rpc('get_profiles_by_ids_for_clients', { p_ids: [clienteId] });
                if (!profErr && profRows && (profRows as any[]).length > 0) {
                    const row = (profRows as any[])[0];
                    resolvedProfileId = row.id ?? null;
                    resolvedUserId = row.user ?? null;
                }
            } catch {
                // ignore resolution errors, we'll fallback to simple matching
            }

            const { data: rpcRecords, error } = await supabase.rpc('get_events_for_company', {
                p_company: companyId,
            });
            if (error) throw error;
            const recordsAll = Array.isArray(rpcRecords) ? rpcRecords : rpcRecords ? [rpcRecords] : [];

            // helper to check client membership supporting either profile id or user id stored in event.client
            const clientMatches = (clientsField: any, pid: string, resolvedProfile: string | null, resolvedUser: string | null) => {
                const arr = Array.isArray(clientsField) ? clientsField : (clientsField ? [clientsField] : []);
                if (!arr || arr.length === 0) return false;
                if (arr.includes(pid)) return true;
                if (resolvedProfile && arr.includes(resolvedProfile)) return true;
                if (resolvedUser && arr.includes(resolvedUser)) return true;
                return false;
            };

            const records = (recordsAll || []).filter((r: any) => clientMatches(r.client, clienteId, resolvedProfileId, resolvedUserId) && r.type === 'appointment');
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
            setEventos(enriched);
        } catch (err) {
            logError('Error al cargar eventos:', err);
        } finally {
            setLoadingEventos(false);
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
                        debug('Upload success for cliente', {
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
                        debug('Upload success for cliente', {
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
                            } catch (e: any) {
                                console.warn('Error calling send-invite helper', e);
                                alert('Error llamando a la función de envío: ' + (e?.message || String(e)));
                            }
                        }
                    }
                } catch (e: any) {
                    console.warn('Error calling send-invite function', e);
                }
            }

            if (savedUserId) {
                try {
                    await persistPendingPrograms(savedUserId);
                } catch (e) {
                    /* ignore */
                }
            }

            onSave();
            onOpenChange(false);
            setRemovePhoto(false);
        } catch (err: any) {
            logError('Error al guardar cliente:', err);
            logError('Error completo:', JSON.stringify(err, null, 2));
            if (err?.response) {
                logError('Response data:', err.response);
            }
            const msg = String(err?.message || err || '');
            if (msg.includes('PGRST204') || msg.includes("Could not find the 'email' column")) {
                alert(
                    'Error al guardar: parece haber un problema con la caché del esquema de PostgREST. Ve a Supabase Dashboard → Settings → API → Reload schema y prueba de nuevo.'
                );
            } else {
                alert(`Error al guardar el cliente: ${err?.message || 'Error desconocido'}`);
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

    const loadPrograms = async () => {
        setLoadingProgramsList(true);
        try {
            if (!cliente?.id) {
                // New client: ensure default local program
                if (programs.length === 0) {
                    const tempId = `t-${Date.now()}`;
                    setPrograms([{ tempId, name: 'Programa 1', persisted: false, description: '', programExercises: [], days: ['A'] }]);
                    setActiveProgramId(tempId);
                }
                return;
            }

            const { data, error } = await supabase.from('programs').select('*').eq('profile', cliente.id);
            if (error) throw error;
            const items = (data || []).map((r: any) => ({ id: r.id, name: r.name, persisted: true, description: r.description || '' }));

            if (items.length) {
                // Attach exercises for each program
                try {
                    const progIds = items.map((it: any) => it.id);
                    const { data: peData, error: peErr } = await supabase.from('program_exercises').select('*, exercise:exercises(*)').in('program', progIds);
                    if (peErr) throw peErr;
                    const map = new Map<string, any[]>();
                    (peData || []).forEach((r: any) => {
                        const arr = map.get(r.program) || [];
                        arr.push(r);
                        map.set(r.program, arr);
                    });
                    const withProgramExercises = items.map((it: any) => {
                        const peList = map.get(it.id) || [];
                        return {
                            ...it,
                            programExercises: peList,
                            days: peList.length ? Array.from(new Set(peList.map((pe: any) => pe.day || 'A'))) : ['A']
                        };
                    });
                    setPrograms(withProgramExercises);
                    setActiveProgramId(withProgramExercises[0].id);
                } catch (err) {
                    console.error('Error loading program_exercises', err);
                    setPrograms(items);
                    setActiveProgramId(items[0].id);
                }
            } else {
                // No programs for existing client: show a default local program so UI isn't empty
                const tempId = `t-${Date.now()}`;
                setPrograms([{ tempId, name: 'Programa 1', persisted: false, description: '', programExercises: [], days: ['A'] }]);
                setActiveProgramId(tempId);
            }
        } catch (e) {
            console.error('Error loading programs', e);
        } finally {
            setLoadingProgramsList(false);
        }
    };

    const addProgram = async () => {
        const nextIndex = programs.length + 1;
        const name = `Programa ${nextIndex}`;
        if (cliente?.id) {
            try {
                const { data, error } = await supabase
                    .from('programs')
                    .insert([{ name, profile: cliente.id, company: companyId }])
                    .select()
                    .single();
                if (error) throw error;
                setPrograms((prev) => [...prev, { id: data.id, name: data.name, persisted: true, description: '' }]);
                setActiveProgramId(data.id);
            } catch (e) {
                console.error('Error creando programa', e);
                alert('Error creando programa: ' + String(e));
            }
        } else {
            const tempId = `t-${Date.now()}`;
            const t = { tempId, name, persisted: false, description: '', programExercises: [], days: ['A'] };
            setPrograms((prev) => [...prev, t]);
            setActiveProgramId(tempId);
        }
    };

    const persistSingleProgram = async (idKey: string) => {
        const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
        if (idx === -1) return null;
        const program = programs[idx];
        if (program.persisted && program.id) return program.id;
        if (!cliente?.id) return null; // will be persisted when profile is created

        try {
            const { data, error } = await supabase
                .from('programs')
                .insert([{ name: program.name, profile: cliente.id, company: companyId, description: program.description || '' }])
                .select()
                .single();
            if (error) throw error;
            const persisted = { id: data.id, name: data.name, persisted: true, description: program.description || data.description || '' };
            setPrograms((prev) => prev.map((t, i) => (i === idx ? persisted : t)));
            // if active was tempId, switch to real id
            if ((program.tempId && activeProgramId === program.tempId) || activeProgramId === program.id) {
                setActiveProgramId(data.id);
            }

            // Legacy "exercises" field is no longer supported; program assignments should be in programExercises

            // persist any locally attached programExercises (new model)
            if (program.programExercises && program.programExercises.length && data.id) {
                try {
                    const inserts = program.programExercises
                        .filter((pe: any) => !pe.id)
                        .map((pe: any, i: number) => ({
                            program: data.id,
                            exercise: pe.exercise?.id || pe.exercise,
                            company: companyId,
                            position: pe.position ?? i,
                            day: pe.day ?? 'A',
                            notes: pe.notes ?? null,
                            reps: pe.reps ?? null,
                            sets: pe.sets ?? null,
                            weight: pe.weight ?? null,
                            secs: pe.secs ?? null,
                        }));
                    if (inserts.length) {
                        const { data: insData, error: insErr } = await supabase.from('program_exercises').insert(inserts).select('*, exercise:exercises(*)');
                        if (insErr) console.error('Error inserting program_exercises', insErr);
                        // attach inserted rows to program state
                        if (insData && insData.length) {
                            setPrograms((prev) => prev.map((t) => (t.id === data.id ? { ...t, programExercises: [...(t.programExercises || []), ...insData] } : t)));
                        }
                    }
                } catch (inner) {
                    console.error('Error inserting program_exercises for pending program', inner);
                }
            }

            return data.id;
        } catch (e) {
            console.error('Error persisting single program', e);
            alert('Error guardando programa: ' + String(e));
            return null;
        }
    };

    const saveProgramName = async (idKey: string, newName: string) => {
        if (!newName || newName.trim() === '') {
            alert('El nombre no puede estar vacío');
            return;
        }
        const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
        if (idx === -1) return;
        const program = programs[idx];
        if (program.persisted && program.id) {
            try {
                const { data, error } = await supabase.from('programs').update({ name: newName }).eq('id', program.id).select().single();
                if (error) throw error;
                setPrograms((prev) => prev.map((t, i) => (i === idx ? { ...t, name: data.name } : t)));
            } catch (e) {
                console.error('Error renombrando programa', e);
                alert('Error al renombrar programa: ' + String(e));
            }
        } else {
            // local update
            setPrograms((prev) => prev.map((t, i) => (i === idx ? { ...t, name: newName } : t)));
            // try to persist immediately if client exists
            if (cliente?.id) {
                await persistSingleProgram(idKey);
            }
        }
    };

    const deleteProgram = async (idKey: string) => {
        const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
        if (idx === -1) return;
        const program = programs[idx];
        if (program.persisted && program.id) {
            try {
                const { error } = await supabase.from('programs').delete().eq('id', program.id);
                if (error) throw error;
                setPrograms((prev) => prev.filter((t, i) => i !== idx));
                if (activeProgramId === idKey) {
                    const remaining = programs.filter((_, i) => i !== idx);
                    if (remaining.length) setActiveProgramId(remaining[0].id ?? remaining[0].tempId);
                    else setActiveProgramId('');
                }
            } catch (e) {
                console.error('Error eliminando programa', e);
                alert('Error al eliminar programa: ' + String(e));
            }
        } else {
            setPrograms((prev) => prev.filter((t, i) => i !== idx));
            if (activeProgramId === idKey) {
                const remaining = programs.filter((_, i) => i !== idx);
                if (remaining.length) setActiveProgramId(remaining[0].id ?? remaining[0].tempId);
                else setActiveProgramId('');
            }
        }
    };

    const persistPendingPrograms = async (profileId: string | null) => {
        if (!profileId) return;
        const pending = programs.filter((t) => !t.persisted);
        if (pending.length === 0) return;
        try {
            const inserts = pending.map((t) => ({ name: t.name, profile: profileId, company: companyId, description: t.description || '' }));
            const { data, error } = await supabase.from('programs').insert(inserts).select();
            if (error) throw error;
            const persisted = data.map((d: any) => ({ id: d.id, name: d.name, persisted: true, description: d.description || '' }));

            // If any pending items had local programExercises attached, persist them against the new program ids
            try {
                for (let i = 0; i < persisted.length; i++) {
                    const newProg = persisted[i];
                    const originalPending = pending[i];
                    const localPEs = originalPending?.programExercises || [];
                    const insertsPE = localPEs.filter((pe: any) => !pe.id).map((pe: any, idx: number) => ({
                        program: newProg.id,
                        exercise: pe.exercise?.id || pe.exercise,
                        company: companyId,
                        position: pe.position ?? idx,
                        day: pe.day ?? 'A',
                        notes: pe.notes ?? null,
                        reps: pe.reps ?? null,
                        sets: pe.sets ?? null,
                        weight: pe.weight ?? null,
                        secs: pe.secs ?? null,
                    }));
                    if (insertsPE.length) {
                        const { data: insData, error: insErr } = await supabase.from('program_exercises').insert(insertsPE).select('*, exercise:exercises(*)');
                        if (insErr) console.error('Error inserting program_exercises', insErr);
                        if (insData && insData.length) {
                            setPrograms((prev) => prev.map((t) => (t.id === newProg.id ? { ...t, programExercises: [...(t.programExercises || []), ...insData] } : t)));
                        }
                    }
                }
            } catch (inner) {
                console.error('Error persisting program_exercises for pending programs', inner);
            }

            const kept = programs.filter((t) => t.persisted);
            setPrograms([...kept, ...persisted]);
            if (persisted.length && !kept.length) setActiveProgramId(persisted[0].id);
        } catch (e) {
            console.error('Error persisting programs', e);
            alert('Error guardando programas: ' + String(e));
        }
    };

    // Add exercises to an existing program in DB
    const addExercisesToProgramDB = async (programId: string, exerciseIds: string[], day?: string) => {
        if (!companyId) return;
        if (!exerciseIds.length) return;
        // Insert with a high temporary position (append) and specified day
        const inserts = exerciseIds.map((exId) => ({ program: programId, exercise: exId, company: companyId, position: 999999, day: day ?? 'A' }));
        const { data, error } = await supabase.from('program_exercises').insert(inserts).select('*, exercise:exercises(*)');
        if (error) throw error;
        return data;
    };

    const [savingPositions, setSavingPositions] = useState<Set<string>>(new Set());
    const [showSavedToast, setShowSavedToast] = useState(false);
    const [savedToastTitle, setSavedToastTitle] = useState<string | null>(null);

    const updateProgramExercisesPositions = async (programId: string, programExercises?: any[]) => {
        let peList: any[];
        let daysForProgram: string[] = [];
        if (Array.isArray(programExercises)) {
            peList = programExercises;
        } else {
            const idx = programs.findIndex((t) => (t.id ?? t.tempId) === programId);
            if (idx === -1) return;
            peList = programs[idx].programExercises || [];
            daysForProgram = programs[idx].days || ['A'];
        }

        try {
            setSavingPositions((s) => new Set([...Array.from(s), programId]));
            const updates: Array<Promise<any>> = [];
            const daysList = daysForProgram.length ? daysForProgram : Array.from(new Set(peList.map((pe: any) => String(pe.day)))).sort();
            for (let di = 0; di < daysList.length; di++) {
                const day = daysList[di];
                const items = peList.filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                for (let i = 0; i < items.length; i++) {
                    const pe = items[i];
                    const newPos = i;
                    if (pe.position !== newPos) {
                        pe.position = newPos;
                        if (pe.id) {
                            updates.push((async () => {
                                const { error } = await supabase.from('program_exercises').update({ position: newPos, day }).eq('id', pe.id);
                                if (error) console.error('Error updating program_exercise position', error);
                            })());
                        }
                    }
                }
            }
            if (updates.length) await Promise.all(updates);
            setPrograms((prev) => prev.map((p) => ((p.id === programId || p.tempId === programId) ? { ...p, programExercises: peList } : p)));

            setSavedToastTitle('Orden guardado');
            setShowSavedToast(true);
        } catch (err) {
            console.error('Error updating program_exercises positions', err);
            setSavedToastTitle('Error guardando el orden');
            setShowSavedToast(true);
        } finally {
            setSavingPositions((s) => {
                const copy = new Set(Array.from(s));
                copy.delete(programId);
                return copy;
            });
            setTimeout(() => setShowSavedToast(false), 2600);
        }
    };

    const moveAssignmentUp = async (programId: string, day: string, peId: string) => {
        setPrograms((prev) => prev.map((p) => {
            if ((p.id ?? p.tempId) !== programId) return p;
            const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
            const idx = items.findIndex((it: any) => (it.id ?? it.tempId) === peId);
            if (idx > 0) {
                const newItems = [...items];
                [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
                const merged = (p.programExercises || []).map((pe: any) => {
                    const match = newItems.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
                    return match ? { ...pe, position: newItems.indexOf(match) } : pe;
                });
                return { ...p, programExercises: merged };
            }
            return p;
        }));
        try { await updateProgramExercisesPositions(programId); } catch (err) { console.error('Error normalizing after move up', err); }
    };

    const moveAssignmentDown = async (programId: string, day: string, peId: string) => {
        setPrograms((prev) => prev.map((p) => {
            if ((p.id ?? p.tempId) !== programId) return p;
            const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
            const idx = items.findIndex((it: any) => (it.id ?? it.tempId) === peId);
            if (idx !== -1 && idx < items.length - 1) {
                const newItems = [...items];
                [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
                const merged = (p.programExercises || []).map((pe: any) => {
                    const match = newItems.find((ni: any) => (ni.id ?? ni.tempId) === (pe.id ?? pe.tempId));
                    return match ? { ...pe, position: newItems.indexOf(match) } : pe;
                });
                return { ...p, programExercises: merged };
            }
            return p;
        }));
        try { await updateProgramExercisesPositions(programId); } catch (err) { console.error('Error normalizing after move down', err); }
    };

    const saveCurrentProgram = async () => {
        if (!activeProgramId) return;
        const idKey = activeProgramId;
        const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
        if (idx === -1) return;
        const p = programs[idx];
        setSavingProgram(true);
        try {
            // If program is temporary, persist it (this will also persist attached programExercises if any)
            if ((p.tempId && idKey === p.tempId) || !p.persisted) {
                await persistSingleProgram(idKey);
                setSavingProgram(false);
                return;
            }

            // Persist description/name updates
            const updates: any = { description: p.description || '' };
            if (p.name) updates.name = p.name;
            const { data, error } = await supabase.from('programs').update(updates).eq('id', p.id).select().single();
            if (error) throw error;
            setPrograms((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: data.name, description: data.description } : x)));

            // Ensure any locally added programExercises without an id are persisted
            const { data: existing, error: exErr } = await supabase.from('program_exercises').select('exercise').eq('program', p.id);
            if (exErr) throw exErr;
            const existingIds = (existing || []).map((r: any) => r.exercise);
            const toAdd = (p.programExercises || []).filter((pe: any) => !pe.id).map((pe: any) => pe.exercise?.id || pe.exercise).filter(Boolean).filter((id: string) => !existingIds.includes(id));
            if (toAdd.length) {
                await addExercisesToProgramDB(p.id, toAdd);
            }
        } catch (e) {
            console.error('Error saving program', e);
            alert('Error guardando programa: ' + String(e));
        } finally {
            setSavingProgram(false);
        }
    };

    const saveProgramById = async (idKey: string) => {
        const idx = programs.findIndex((t) => (t.id ?? t.tempId) === idKey);
        if (idx === -1) return;
        const p = programs[idx];
        setSavingProgram(true);
        try {
            if ((p.tempId && idKey === p.tempId) || !p.persisted) {
                await persistSingleProgram(idKey);
                setSavingProgram(false);
                return;
            }

            const updates: any = { description: p.description || '' };
            if (p.name) updates.name = p.name;
            const { data, error } = await supabase.from('programs').update(updates).eq('id', p.id).select().single();
            if (error) throw error;
            setPrograms((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: data.name, description: data.description } : x)));

            // normalize positions
            try {
                await updateProgramExercisesPositions(p.id);
            } catch (err) {
                console.error('Error normalizing after save', err);
            }
        } catch (e) {
            console.error('Error saving program', e);
            alert('Error guardando programa: ' + String(e));
        } finally {
            setSavingProgram(false);
        }
    };

    const openAddExercises = async (programId: string, day?: string) => {
        setCurrentProgramForPicker(programId);
        setCurrentDayForPicker(day ?? null);
        setSelectedExerciseIds(new Set());
        setShowAddExercisesDialog(true);
        try {
            if (!companyId) return;
            setExercisesLoading(true);
            const { data, error } = await supabase.from('exercises').select('*').eq('company', companyId).order('name');
            if (error) throw error;
            setExercisesForCompany((data as any) || []);
        } catch (e) {
            console.error('Error loading exercises for picker', e);
            alert('Error cargando ejercicios: ' + String(e));
        } finally {
            setExercisesLoading(false);
        }
    };

        // Legacy helper to remove an exercise from a program by exercise id removed; deletions should target program_exercises rows directly by id

        const toggleSelectExercise = (id: string) => {
            setSelectedExerciseIds((prev) => {
                const s = new Set(prev);
                if (s.has(id)) s.delete(id);
                else s.add(id);
                return s;
            });
        };

        const confirmAddExercises = async () => {
            if (!currentProgramForPicker) return;
            const selected = Array.from(selectedExerciseIds);
            if (!selected.length) {
                setShowAddExercisesDialog(false);
                setCurrentProgramForPicker(null);
                setCurrentDayForPicker(null);
                return;
            }

            const targetDay = currentDayForPicker ?? 'A';

            // If program is temporary, attach locally as programExercises (temp)
            if (currentProgramForPicker.startsWith('t-')) {
                setPrograms((prev) => prev.map((p) => {
                    if (p.tempId !== currentProgramForPicker) return p;
                    const existingPE = p.programExercises || [];
                    const startIndex = existingPE.filter((pe: any) => String(pe.day) === targetDay).length;
                    const newPEs = exercisesForCompany.filter((e) => selected.includes(e.id)).map((e, i) => ({ tempId: `tpe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, program: currentProgramForPicker, exercise: e, position: startIndex + i, day: targetDay }));
                    return { ...p, programExercises: [...existingPE, ...newPEs] };
                }));
                setShowAddExercisesDialog(false);
                setCurrentProgramForPicker(null);
                setCurrentDayForPicker(null);
                setSelectedExerciseIds(new Set());
                return;
            }

            // Persist to DB and attach locally
            setAddingExercisesLoading(true);
            try {
                const inserted = await addExercisesToProgramDB(currentProgramForPicker, selected, targetDay);
                // inserted includes exercise expansion
                setPrograms((prev) => prev.map((p) => {
                    if (p.id !== currentProgramForPicker) return p;
                    const existingPE = p.programExercises || [];
                    const addedPE = (inserted || []).map((r: any) => ({ id: r.id, program: r.program, exercise: r.exercise, position: r.position, notes: r.notes, day: r.day, reps: r.reps, sets: r.sets, weight: r.weight, secs: r.secs, created_at: r.created_at }));
                    return { ...p, programExercises: [...existingPE, ...addedPE] };
                }));
                // Normalize positions for the program
                try {
                    await updateProgramExercisesPositions(currentProgramForPicker);
                } catch (err) {
                    console.error('Error normalizing positions after add', err);
                }

                setShowAddExercisesDialog(false);
                setCurrentProgramForPicker(null);
                setCurrentDayForPicker(null);
                setSelectedExerciseIds(new Set());
            } catch (e) {
                console.error('Error adding exercises to program', e);
                alert('Error añadiendo ejercicios: ' + String(e));
            } finally {
                setAddingExercisesLoading(false);
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
                            defaultValue="datos"
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="datos">Datos</TabsTrigger>
                                <TabsTrigger value="historial" disabled={!cliente?.id}>
                                    Citas
                                </TabsTrigger>
                                <TabsTrigger value="programas">Programas</TabsTrigger>
                            </TabsList>

                            <TabsContent value="datos" className="flex-1 overflow-y-auto mt-4">
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
                            </TabsContent>

                            <TabsContent value="programas" className="flex-1 flex flex-col overflow-hidden mt-4">
                                <div className="px-1 flex-1 flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <Tabs value={activeProgramId} onValueChange={setActiveProgramId}>
                                            <TabsList className="inline-flex items-center gap-2 overflow-x-auto overflow-y-hidden hide-scrollbar justify-start whitespace-nowrap">
                                                {programs.map((p) => {
                                                    const idKey = p.id ?? p.tempId;
                                                    return (
                                                        <div key={idKey} className="flex items-center gap-2">
                                                            <TabsTrigger value={idKey} onClick={(e) => { e.stopPropagation(); setActiveProgramId(idKey); }}>
                                                                <div className="flex items-center gap-2">
                                                                    {editingProgramId === idKey ? (
                                                                        <input
                                                                            autoFocus
                                                                            className="text-sm rounded px-2 py-0.5 w-40"
                                                                            value={editingProgramName}
                                                                            onChange={(e) => setEditingProgramName(e.target.value)}
                                                                            onBlur={async () => {
                                                                                const newName = editingProgramName.trim();
                                                                                setEditingProgramId(null);
                                                                                setEditingProgramName('');
                                                                                if (newName && newName !== p.name) {
                                                                                    await saveProgramName(idKey, newName);
                                                                                } else if (!newName) {
                                                                                    alert('El nombre no puede estar vacío');
                                                                                }
                                                                            }}
                                                                            onKeyDown={async (e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    (e.target as HTMLInputElement).blur();
                                                                                } else if (e.key === 'Escape') {
                                                                                    setEditingProgramId(null);
                                                                                    setEditingProgramName('');
                                                                                }
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <span className="text-sm" onDoubleClick={(e) => { e.stopPropagation(); setEditingProgramId(idKey); setEditingProgramName(p.name); }}>{p.name}</span>
                                                                    )}
                                                                    <ActionButton className="h-6 w-6 p-0.5" aria-label="Eliminar programa" onClick={(e:any) => { e.stopPropagation(); setProgramToDeleteId(idKey); setShowDeleteProgramDialog(true); }}>
                                                                        <Trash className="h-3 w-3" />
                                                                    </ActionButton>
                                                                </div>
                                                            </TabsTrigger>
                                                        </div>
                                                    );
                                                })}

                                                <div className="pl-1">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 h-7 text-sm font-medium bg-transparent text-muted-foreground shadow-none border-0 transition-colors hover:text-foreground hover:bg-[hsl(var(--background))]"
                                                                    onClick={addProgram}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-[hsl(var(--sidebar-accent))] border shadow-sm text-black rounded px-3 py-1 max-w-xs cursor-default">Crear programa</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </TabsList>
                                        </Tabs>


                                    </div>

                                    <Tabs value={activeProgramId} onValueChange={setActiveProgramId} className="mt-4">
                                        {programs.map((p) => {
                                            const idKey = p.id ?? p.tempId;
                                            return (
                                                <TabsContent key={idKey} value={idKey} className="p-0 flex-1 overflow-hidden">
                                                    <div className="h-full overflow-y-auto">
                                                        <Card className="p-4 space-y-4 h-full">
                                                        <div className="mt-2">
                                                            <Input
                                                                value={p.description || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setPrograms((prev) => prev.map((x) => (x.id === p.id || x.tempId === p.tempId ? { ...x, description: val } : x)));
                                                                }}
                                                                onBlur={async () => {
                                                                    // If user added description and this program isn't persisted yet, persist it
                                                                    const current = programs.find((x) => (x.id === p.id || x.tempId === p.tempId));
                                                                    if ((current?.description || '').trim() !== '' && !current?.persisted) {
                                                                        await persistSingleProgram(idKey);
                                                                    }
                                                                }}
                                                                placeholder="Descripción del programa"
                                                                className="w-full"
                                                            />
                                                        </div>

                                                        {/* Program exercises */}
                                                        <div>
                                                            <div className="mt-2">


                                                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
                                                                    {(p.days || ['A']).slice(0,7).map((day: string, di: number) => (
                                                                        <div key={day} className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px]" onDragOver={(e) => { e.preventDefault(); handleDragOverColumn(e, p.id ?? p.tempId, day);} } onDrop={async (e) => {
                                                                            e.preventDefault();
                                                                            try {
                                                                                const payload = e.dataTransfer?.getData('text') || e.dataTransfer?.getData('application/json');
                                                                                if (!payload) return;
                                                                                const parsed = JSON.parse(payload);
                                                                                const peId = parsed.peId;
                                                                                setPrograms((prev) => prev.map((prog) => {
                                                                                    if ((prog.id || prog.tempId) !== (p.id || p.tempId)) return prog;
                                                                                    const items = (prog.programExercises || []).map((it: any) => it.id === peId || it.tempId === peId ? { ...it, day } : it);
                                                                                    return { ...prog, programExercises: items };
                                                                                }));
                                                                                if (peId && !String(peId).startsWith('tpe-')) {
                                                                                    const { error } = await supabase.from('program_exercises').update({ day }).eq('id', peId);
                                                                                    if (error) console.error('Error updating day for program_exercise', error);
                                                                                    // normalize positions for this program/day then persist
                                                                                    const items = ((p.programExercises || []).filter((pe: any) => String(pe.day) === day));
                                                                                    for (let i = 0; i < items.length; i++) {
                                                                                        const pe = items[i];
                                                                                        if (pe.id) {
                                                                                            const { error } = await supabase.from('program_exercises').update({ position: i }).eq('id', pe.id);
                                                                                            if (error) console.error('Error updating position', error);
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } catch (err) {
                                                                                console.error('Error handling drop', err);
                                                                            }
                                                                        }}>
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <div className="text-sm font-medium">{`Día ${day}`}</div>
                                                                                <div>
                                                                                    <ActionButton tooltip="Eliminar día" onClick={() => setPrograms((prev) => prev.map((pr) => pr.id === p.id || pr.tempId === p.tempId ? { ...pr, days: (pr.days || ['A']).filter((dd:string)=> dd !== day) } : pr))} aria-label="Eliminar día">
                                                                                        <Trash className="h-4 w-4" />
                                                                                    </ActionButton>
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-2 min-h-[40px]">
                                                                                {(() => {
                                                                                    const items = (p.programExercises || []).filter((pe: any) => String(pe.day) === day).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                                                                                    if (!items.length) {
                                                                                        return (
                                                                                            <div className="flex items-center justify-center py-6">
                                                                                                <Button onClick={async () => {
                                                                                                    setCurrentProgramForPicker(p.id ?? p.tempId);
                                                                                                    setCurrentDayForPicker(day);
                                                                                                    try {
                                                                                                        const { data } = await supabase.from('exercises').select('*').eq('company', p.company).order('name');
                                                                                                        setExercisesForCompany((data as any) || []);
                                                                                                        setShowAddExercisesDialog(true);
                                                                                                    } catch (err) {
                                                                                                        console.error('Error loading exercises', err);
                                                                                                    }
                                                                                                }} className="px-4 py-2">+ Ejercicio</Button>
                                                                                            </div>
                                                                                        );
                                                                                    } else {
                                                                                        return items.map((pe: any) => (
                                                                                            <div key={pe.id || pe.tempId} draggable role="button" aria-grabbed="false" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); } }} onDragStart={(ev) => handleDragStart(ev, p.id ?? p.tempId, pe.id ?? pe.tempId)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()} className={`p-2 bg-white rounded border flex items-center justify-between gap-2 transition-all duration-150 motion-safe:transform-gpu hover:scale-[1.01] ${dragOver?.programId === (p.id ?? p.tempId) && dragOver?.day === day ? 'shadow-lg' : ''}`}>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                                                                                    <div>
                                                                                                        <div className="text-sm font-medium">{pe.exercise?.name}</div>
                                                                                                        <div className="text-xs text-muted-foreground">{pe.exercise?.description}</div>
                                                                                                        <div className="text-xs text-muted-foreground mt-1">{(pe.reps || pe.sets) ? `${pe.reps ?? '-'} x ${pe.sets ?? '-'}` : ''} {pe.weight ? `· ${pe.weight}kg` : ''} {pe.secs ? `· ${pe.secs}s` : ''}</div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <Button size="sm" variant="ghost" onClick={() => moveAssignmentUp(p.id ?? p.tempId, pe.day ?? 'A', pe.id ?? pe.tempId)} aria-label="Mover arriba"><ArrowUp className="h-4 w-4" /></Button>
                                                                                                    <Button size="sm" variant="ghost" onClick={() => moveAssignmentDown(p.id ?? p.tempId, pe.day ?? 'A', pe.id ?? pe.tempId)} aria-label="Mover abajo"><ArrowDown className="h-4 w-4" /></Button>
                                                                                                    <ActionButton tooltip="Editar asignación" onClick={() => { setEditingProgramExercise(pe); setShowEditProgramExerciseDialog(true); }} aria-label="Editar asignación">
                                                                                                        <PencilLine className="h-4 w-4" />
                                                                                                    </ActionButton>
                                                                                                    <ActionButton tooltip="Eliminar asignación" onClick={async () => {
                                                                                                        try {
                                                                                                            // If temp, remove locally
                                                                                                            if (String(pe.tempId || '').startsWith('tpe-')) {
                                                                                                                setPrograms((prev) => prev.map((pr) => (pr.tempId === p.tempId ? { ...pr, programExercises: (pr.programExercises || []).filter((x: any) => x.tempId !== pe.tempId) } : pr)));
                                                                                                                return;
                                                                                                            }
                                                                                                            const { error } = await supabase.from('program_exercises').delete().eq('id', pe.id);
                                                                                                            if (error) throw error;
                                                                                                            setPrograms((prev) => prev.map((pr) => (pr.id === p.id ? { ...pr, programExercises: (pr.programExercises || []).filter((x: any) => x.id !== pe.id) } : pr)));
                                                                                                            await updateProgramExercisesPositions(p.id);
                                                                                                        } catch (err) {
                                                                                                            console.error('Error deleting program_exercise', err);
                                                                                                            alert('Error eliminando asignación: ' + String(err));
                                                                                                        }
                                                                                                    }} aria-label="Eliminar asignación">
                                                                                                        <Trash className="h-4 w-4" />
                                                                                                    </ActionButton>
                                                                                                </div>
                                                                                            </div>
                                                                                        ));
                                                                                    }
                                                                                })()}

                                                                                {dragOver?.programId === (p.id ?? p.tempId) && dragOver?.day === day && (p.programExercises || []).filter((pe: any) => String(pe.day) === day).length === 0 && (
                                                                                    <div className="p-4 border-2 border-dashed border-border rounded text-sm text-muted-foreground text-center animate-pulse">Drop aquí</div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {((p.days || []).length < 7) && (
                                                                        <Card className="border rounded p-1 bg-muted/10 min-w-[120px] md:min-w-[90px] flex items-center justify-center cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setPrograms(prev => prev.map(pr => pr.id === p.id ? { ...pr, days: [...(pr.days || ['A']), String.fromCharCode(((pr.days || ['A']).slice(-1)[0].charCodeAt(0) + 1))] } : pr))}>
                                                                            <div className="text-2xl font-bold">+</div>
                                                                        </Card>
                                                                    )}
                                                                </div>

                                                            </div>
                                                        </div>



                                                    </Card>
                                                    </div>
                                                </TabsContent>
                                            );
                                        })}
                                    </Tabs>


                            </div>
                        </TabsContent>
                            <TabsContent value="historial" className="flex-1 overflow-y-auto mt-4">
                                <div className="space-y-4 px-1">
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

                <AlertDialog open={showDeleteProgramDialog} onOpenChange={setShowDeleteProgramDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar programa?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => {
                                    setProgramToDeleteId(null);
                                }}
                            >
                                Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async () => {
                                    if (!programToDeleteId) return;
                                    await deleteProgram(programToDeleteId);
                                    setShowDeleteProgramDialog(false);
                                    setProgramToDeleteId(null);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Edit program exercise dialog */}
                <ProgramExerciseDialog
                    open={showEditProgramExerciseDialog}
                    onOpenChange={setShowEditProgramExerciseDialog}
                    programExercise={editingProgramExercise}
                    onSaved={(updated) => {
                        if (!updated) return;
                        setPrograms((prev) => prev.map((pr) => (pr.id === updated.program ? { ...pr, programExercises: (pr.programExercises || []).map((pe: any) => (pe.id === updated.id ? updated : pe)) } : pr)));
                        try {
                            updateProgramExercisesPositions(updated.program);
                        } catch (err) {
                            console.error('Error normalizing after save', err);
                        }
                    }}
                />

                {/* Add exercises dialog */}
                <Dialog open={showAddExercisesDialog} onOpenChange={setShowAddExercisesDialog}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Añadir ejercicios al programa</DialogTitle>
                        </DialogHeader>

                        {showSavedToast && savedToastTitle && (
                            <InviteToast title={savedToastTitle} durationMs={2500} onClose={() => setShowSavedToast(false)} />
                        )}

                        <div className="p-2">
                            {exercisesLoading ? (
                                <div className="py-6 flex items-center justify-center">Cargando ejercicios...</div>
                            ) : (
                                <div className="h-64 overflow-y-auto">
                                    <div className="grid gap-2">
                                        {exercisesForCompany.map((ex) => (
                                            <label key={ex.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                                                <Checkbox checked={selectedExerciseIds.has(ex.id)} onCheckedChange={() => toggleSelectExercise(ex.id)} />
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{ex.name}</div>
                                                    {ex.description && <div className="text-xs text-muted-foreground">{ex.description}</div>}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setShowAddExercisesDialog(false)}>Cancelar</Button>
                            <Button onClick={confirmAddExercises} disabled={selectedExerciseIds.size === 0 || addingExercisesLoading}>
                                {addingExercisesLoading ? 'Añadiendo...' : 'Añadir'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        );
}
