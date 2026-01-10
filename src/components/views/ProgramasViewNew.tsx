import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfileByUserId } from '@/lib/supabase';
import ClientPrograms from '@/components/clientes/ClientPrograms';
import { useClientPrograms } from '@/components/clientes/useClientPrograms';

export function ProgramasView() {
    const { user, companyId } = useAuth();
    const [profile, setProfile] = useState<any | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (user?.role === 'client') {
            (async () => {
                try {
                    const p = await fetchProfileByUserId(user.id);
                    if (!cancelled) setProfile(p ?? null);
                } catch (err) {
                    console.error('Error loading client profile for Programas view', err);
                }
            })();
        } else {
            setProfile(null);
        }
        return () => { cancelled = true; };
    }, [user]);

    const api = useClientPrograms({ cliente: profile, companyId });

    if (!user) return <div className="p-4">Cargando...</div>;
    if (user.role === 'client' && !profile) return <div className="p-4">Cargando programas...</div>;

    if (user.role !== 'client') {
        return (
            <div className="p-4">
                <div className="rounded-lg border bg-card p-4">Abre la ficha de un cliente y usa la pestaña <strong>Programas</strong> para gestionar sus programas.</div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <ClientPrograms api={api} />
        </div>
    );
}

export default ProgramasView;
