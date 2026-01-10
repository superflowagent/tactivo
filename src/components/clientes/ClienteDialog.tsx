/* DEPRECATED: ClienteDialog removed — use the client page at /:companyName/panel/cliente/:uid instead */

export default function ClienteDialog() {
    return null as any;
}

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
        savedUserId = cliente.id ?? savedUser?.id ?? savedUser?.user ?? null;
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
        savedUserId = savedUser?.id || savedUser?.user || null;
    }
}

const profileIdForPrograms = cliente?.id || savedUserId || savedUser?.id || savedUser?.user || null;
if (profileIdForPrograms) {
    await clientProgramsApi.persistAll(profileIdForPrograms);
    clientProgramsApi.markCurrentAsClean();
    try { clientProgramsApi.markPendingChanges(false); } catch { }
    setLocalPendingChanges(false);
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
    // Mark pending changes for any client form edits
    setLocalPendingChanges(true);
    // eslint-disable-next-line no-console
    console.debug('ClienteDialog.handleChange', field, value);
    if (clientProgramsApi && typeof clientProgramsApi.markPendingChanges === 'function') {
        clientProgramsApi.markPendingChanges(true);
    } else {
        // Dev-time warning to help debugging
        // eslint-disable-next-line no-console
        console.warn('clientProgramsApi.markPendingChanges not available', clientProgramsApi);
    }

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
        <Dialog open={open} onOpenChange={(next) => { if (!next) clientProgramsApi.resetToInitial(); onOpenChange(next); }}>
            <DialogContent className="h-screen w-screen max-w-full max-h-full flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6">
                    <div className="flex items-center gap-2">
                        {cliente ? <PencilLine className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        <DialogTitle>{cliente ? `${cliente.name} ${cliente.last_name}` : 'Crear Cliente'}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {cliente ? 'Modifica los datos del cliente' : 'Completa los datos del nuevo cliente'}
                    </DialogDescription>
                </DialogHeader>

                <div className="w-full px-6 flex-1 flex flex-col">
                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="flex-1 flex flex-col overflow-hidden min-h-0"
                    >
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="datos">Datos</TabsTrigger>
                            <TabsTrigger value="bonos">Bonos</TabsTrigger>
                            <TabsTrigger value="programas">Programas</TabsTrigger>
                            <TabsTrigger value="historial" disabled={!cliente?.id}>
                                Citas{cliente?.id ? ` (${eventos.length})` : ''}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="datos" className="flex-1 min-h-0 mt-4 overflow-hidden px-6">
                            <div className="h-full overflow-y-auto pr-2">
                                <form id="cliente-form" onSubmit={handleSubmit} className="space-y-6">


                                    {/* Campos Obligatorios reorganizados */}
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
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

                                            <div className="space-y-2">
                                                <Label htmlFor="dni">DNI *</Label>
                                                <Input
                                                    id="dni"
                                                    value={formData.dni || ''}
                                                    onChange={(e) => handleChange('dni', e.target.value)}
                                                    required
                                                />
                                            </div>

                                            {/* Foto arriba a la derecha */}
                                            <div className="space-y-2 row-span-2 flex flex-col items-start md:items-end w-full">
                                                <Label htmlFor="photo" className="w-full text-left md:text-right pr-0 md:pr-6">Foto</Label>
                                                <div className="w-full flex justify-start md:justify-end pr-0 md:pr-6">
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

                                                    <div className="relative mt-0 flex justify-end">
                                                        <label htmlFor="photo" className="w-32 h-32 rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground cursor-pointer">
                                                            {photoPreview ? (
                                                                <img src={photoPreview} alt="Preview" className="object-cover w-full h-full" />
                                                            ) : (
                                                                <span>Foto</span>
                                                            )}
                                                        </label>

                                                        {/* Delete overlay */}
                                                        {(photoPreview || photoFile || (formData.photo && !removePhoto)) && (
                                                            <ActionButton
                                                                tooltip="Eliminar foto"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setPhotoFile(null);
                                                                    setPhotoPreview(null);
                                                                    setRemovePhoto(true);
                                                                    setFormData((prev) => ({ ...prev, photo: '' }));
                                                                    // Reset file input
                                                                    const input = document.getElementById('photo') as HTMLInputElement;
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

                                            <div className="space-y-2 md:col-span-1">
                                                <Label className="" htmlFor="address">Dirección</Label>
                                                <Input
                                                    id="address"
                                                    value={formData.address || ''}
                                                    onChange={(e) => handleChange('address', e.target.value)}
                                                />
                                            </div>

                                        </div>
                                    </div>

                                    {/* Campos Opcionales */}
                                    <div className="space-y-4 pt-0">
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

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                                            <div className="space-y-2 md:col-span-1">
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

                                            <div className="space-y-2 md:col-span-1">
                                                <Label>Edad</Label>
                                                <Input
                                                    value={edad !== null ? `${edad} años` : ''}
                                                    disabled
                                                    className="bg-muted h-10"
                                                />
                                            </div>

                                            <div className="space-y-2 md:col-span-1">
                                                <Label htmlFor="occupation">Ocupación</Label>
                                                <Input
                                                    id="occupation"
                                                    value={formData.occupation || ''}
                                                    onChange={(e) => handleChange('occupation', e.target.value)}
                                                />
                                            </div>

                                            <div className="space-y-2 md:col-span-1">
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
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="class_credits">Clases</Label>
                                            <Input
                                                id="class_credits"
                                                type="text"
                                                value={String(formData.class_credits ?? '')}
                                                onChange={(e) => handleChange('class_credits', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="programas" className="flex-1 min-h-0 mt-4 overflow-hidden px-6">
                            <div className="h-full overflow-y-auto pr-2">
                                <ClientPrograms api={clientProgramsApi} />
                            </div>
                        </TabsContent>
                        <TabsContent value="historial" className="flex-1 min-h-0 mt-4 overflow-hidden px-6">
                            <div className="h-full overflow-y-auto pr-2">
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

                    <DialogFooter className="mt-4 px-6 pb-6 sm:justify-between">
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
                            <div className="flex gap-2 items-center">
                                <div>
                                    {(clientProgramsApi.hasPendingChanges || localPendingChanges) && (
                                        <div className="inline-flex items-center gap-2">
                                            <div className="rounded-md bg-amber-600 text-white px-3 py-1 text-sm font-semibold shadow">⚠️ Cambios pendientes</div>
                                        </div>
                                    )}
                                </div>
                                <Button type="button" variant="outline" onClick={() => { clientProgramsApi.resetToInitial(); onOpenChange(false); }}>
                                    Cancelar
                                </Button>
                                <Button type="button" onClick={(e) => handleSubmit(e as any)} disabled={loading}>
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </div>

